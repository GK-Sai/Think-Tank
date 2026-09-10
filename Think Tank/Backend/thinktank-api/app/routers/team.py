"""The Team Members page."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Role, User
from app.schemas import InviteIn, MemberPatchIn, member_out
from app.security import current_user, hash_password

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("")
async def list_team(me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    rows = await db.execute(select(User).order_by(User.id))
    return [member_out(u) for u in rows.scalars()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def invite(body: InviteIn, me: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can add members")

    email = body.email.strip().lower()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Somebody already has that email address")

    # The username is the first name, made unique with a number if it is taken
    # — two Priyas should not collide on the sign-in screen.
    base = (body.name.strip().split() or ["member"])[0].lower()
    username, n = base, 1
    while (await db.execute(select(User.id).where(User.username == username))).scalar_one_or_none():
        n += 1
        username = f"{base}{n}"

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(settings.default_member_password),
        name=body.name.strip(),
        title=body.role,                 # the job title shown in the Role pill
        role=Role.member,                # a new account is never a chairman
        dept=body.dept,
        avatar_sex=body.avatar_sex,
        avatar_variant=body.avatar_variant,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return member_out(user)


@router.patch("/{user_id}")
async def update_member(
    user_id: int,
    body: MemberPatchIn,
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    # A member's department and job title are the chairman's to set — the Edit
    # Role dialog is only shown to him. Without this check any signed-in member
    # could rename, move or retitle anybody else by calling the API directly.
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can change a member's details")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member no longer exists")

    if body.name is not None:
        user.name = body.name
    if body.dept is not None:
        user.dept = body.dept
    if body.role is not None:
        user.title = body.role      # `role` in the body is the job title

    await db.commit()
    await db.refresh(user)
    return member_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: int,
    me: User = Depends(current_user),
    db: AsyncSession = Depends(get_session),
):
    if user_id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own account")
    if me.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can remove members")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member no longer exists")

    await db.delete(user)
    await db.commit()
    return None
