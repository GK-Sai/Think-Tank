"""
Direct messages.

One-to-one, beside the group discussion. The discussion is the record of how
a decision was made and belongs to everybody; this is for the quiet word you
would otherwise have on WhatsApp and lose.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import DmMessage, DmThread, User
from app.rules import actor_label, notify, now
from app.schemas import MessageIn, thread_out
from app.security import current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


async def _find_thread(db: AsyncSession, a: int, b: int) -> DmThread | None:
    """The pair is stored sorted, which makes this one indexed lookup."""
    lo, hi = sorted((a, b))
    rows = await db.execute(
        select(DmThread).where(DmThread.user_a_id == lo, DmThread.user_b_id == hi)
    )
    return rows.scalar_one_or_none()


async def _my_threads(db: AsyncSession, me: User) -> list[DmThread]:
    rows = await db.execute(
        select(DmThread).where(or_(DmThread.user_a_id == me.id, DmThread.user_b_id == me.id))
    )
    return list(rows.scalars())


@router.get("/unread-count")
async def unread_count(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    threads = await _my_threads(db, me)
    n = sum(
        1
        for t in threads
        for m in t.messages
        if m.from_id != me.id and m.read_at is None
    )
    return {"count": n}


@router.get("")
async def list_threads(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """Every thread I am part of, newest first, with its unread count."""
    threads = await _my_threads(db, me)

    other_ids = [t.user_b_id if t.user_a_id == me.id else t.user_a_id for t in threads]
    people = {}
    if other_ids:
        rows = await db.execute(select(User).where(User.id.in_(other_ids)))
        people = {u.id: u for u in rows.scalars()}

    out = []
    for t in threads:
        other = people.get(t.user_b_id if t.user_a_id == me.id else t.user_a_id)
        if other is None:          # the other person has left the team
            continue
        out.append(thread_out(t, other, me, with_messages=False))

    out.sort(key=lambda r: r["last_at"] or "", reverse=True)
    return out


@router.get("/{user_id}")
async def thread_with(user_id: int, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """The conversation with one person. Opening it marks it read."""
    other = await db.get(User, user_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person is no longer on the team")

    thread = await _find_thread(db, me.id, other.id)
    if thread:
        stamped = now()
        for m in thread.messages:
            if m.from_id != me.id and m.read_at is None:
                m.read_at = stamped
        await db.commit()
        await db.refresh(thread)

    return thread_out(thread, other, me, with_messages=True)


@router.post("/{user_id}")
async def send_message(
    user_id: int, body: MessageIn,
    me: User = Depends(current_user), db: AsyncSession = Depends(get_session),
):
    other = await db.get(User, user_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person is no longer on the team")
    if other.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot message yourself")

    clean = (body.text or "").strip()
    if not clean:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write something first")

    thread = await _find_thread(db, me.id, other.id)
    if thread is None:
        lo, hi = sorted((me.id, other.id))
        thread = DmThread(user_a_id=lo, user_b_id=hi)
        db.add(thread)
        await db.flush()

    db.add(DmMessage(thread_id=thread.id, from_id=me.id, text=clean, created_at=now()))
    notify(db, user_ids=[other.id], icon="team", title=f"Message from {actor_label(me)}", link=None)

    await db.commit()
    await db.refresh(thread)
    return thread_out(thread, other, me, with_messages=True)
