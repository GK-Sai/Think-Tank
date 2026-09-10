"""
The Think Log.

Where the chairman works out what he is going to raise. The team can read
that — it is the reasoning behind the ideas they are about to be asked
about — but nobody else's private notes appear on your page.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Role, ThinkLog, ThinkLogPoint, User
from app.rules import now
from app.schemas import PointPatchIn, ThinkLogIn, log_out
from app.security import current_user

router = APIRouter(prefix="/api/think-logs", tags=["think-logs"])


@router.get("")
async def list_logs(
    q: str | None = Query(default=None),
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    """Your own notes, plus the chairman's."""
    chairs = select(User.id).where(User.role == Role.chairman)
    stmt = (
        select(ThinkLog)
        .where(or_(ThinkLog.owner_id == me.id, ThinkLog.owner_id.in_(chairs)))
        .order_by(ThinkLog.created_at.desc(), ThinkLog.id.desc())
    )
    rows = await db.execute(stmt)
    logs = list(rows.scalars())

    needle = (q or "").strip().lower()
    if needle:
        logs = [
            l for l in logs
            if needle in l.title.lower() or any(needle in p.text.lower() for p in l.points)
        ]
    return [log_out(l) for l in logs]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_log(body: ThinkLogIn, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    if not body.points:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A log needs at least one point")

    log = ThinkLog(
        owner_id=me.id,
        date=date.today(),
        created_at=now(),
        # A log's title is the first line of its first point unless one was given.
        title=body.title or body.points[0].text.split("\n")[0].strip() or "Untitled log",
        sample=False,
    )
    db.add(log)
    await db.flush()

    for i, p in enumerate(body.points):
        db.add(ThinkLogPoint(log_id=log.id, position=i, text=p.text, states=list(p.states)))

    await db.commit()
    await db.refresh(log)
    return log_out(log)


@router.patch("/points/{point_id}")
async def patch_point(
    point_id: int,
    body: PointPatchIn | None = None,
    state: str | None = Query(default=None),
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    One endpoint, two jobs — the request says which you meant.

    With `?state=idea|task`: record that the point has become an idea or a
    task. Chairman only, since he is the only one who can turn a point into
    either. The new state is *added* to what the point already is rather than
    replacing it, so a note sent to Tasks and then to Ideas is both. Passing
    no state clears the point back to unactioned.

    With a `{"text": …}` body: reword a point you have already saved. The note
    autosaves a few seconds after you stop typing, so the first version of a
    thought is on the record before you have finished having it; editing is
    how you tidy it afterwards.
    """
    point = await db.get(ThinkLogPoint, point_id)
    if point is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That point no longer exists")
    log = await db.get(ThinkLog, point.log_id)

    if body is not None and body.text is not None:
        text = body.text.strip()
        if not text:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A point cannot be empty")
        if log.owner_id != me.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own think log")

        point.text = text
        # A log's title is the first line of its first point, so rewording
        # that point renames the log with it — leaving the old title behind
        # would make the past-logs list disagree with what the log says.
        if log.points and log.points[0].id == point.id:
            log.title = text.split("\n")[0].strip()
    else:
        if me.role != Role.chairman:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can action a think-log point")
        states = list(point.states or [])
        if not state:
            point.states = []
        elif state not in states:
            point.states = [*states, state]
        else:
            point.states = states

    await db.commit()
    await db.refresh(log)
    return log_out(log)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_log(log_id: int, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    log = await db.get(ThinkLog, log_id)
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That log no longer exists")
    if log.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own think log")

    await db.delete(log)
    await db.commit()
    return None
