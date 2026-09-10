"""
The bell.

Notifications are written from wherever the thing happened (see `notify` in
rules.py, and the note there about why the list is deliberately short). This
router only reads them and marks them read.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Notification, User
from app.schemas import notif_out
from app.security import current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/unread-count")
async def unread_count(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    rows = await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == me.id, Notification.unread.is_(True))
    )
    return {"count": rows.scalar_one()}


@router.get("")
async def list_notifications(
    tab: str | None = Query(default=None),
    q: str | None = Query(default=None),
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(Notification).where(Notification.user_id == me.id)
    if tab == "unread":
        stmt = stmt.where(Notification.unread.is_(True))
    elif tab == "reminders":
        stmt = stmt.where(Notification.reminder.is_(True))
    if q and q.strip():
        stmt = stmt.where(Notification.title.ilike(f"%{q.strip()}%"))

    stmt = stmt.order_by(Notification.created_at.desc(), Notification.id.desc())
    rows = await db.execute(stmt)
    return [notif_out(n) for n in rows.scalars()]


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == me.id, Notification.unread.is_(True))
        .values(unread=False)
    )
    await db.commit()
    return None


@router.post("/{notif_id}/read")
async def mark_read(notif_id: int, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    n = await db.get(Notification, notif_id)
    # Somebody else's notification is not yours to read, and saying "no longer
    # exists" is the honest answer to a row you were never shown.
    if n is None or n.user_id != me.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That notification no longer exists")

    n.unread = False
    await db.commit()
    return notif_out(n)
