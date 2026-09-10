"""
Sign in, who am I, sign out.

Auth is a Bearer token. `login` returns the JWT in the response body; the
frontend stores it and sends `Authorization: Bearer <token>` on every request.
`logout` has nothing to clear server-side — the client just drops the token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.schemas import LoginIn, public_user
from app.security import (
    create_access_token,
    current_user,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_session)):
    """Username or email, either is accepted — people type whichever they remember."""
    key = body.username.strip().lower()
    result = await db.execute(
        select(User).where(or_(User.username == key, func.lower(User.email) == key))
    )
    user = result.scalar_one_or_none()

    # Two different messages, because this is an internal tool where "which of
    # the two did I get wrong" is the useful answer, not an attack surface.
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No account matches that username.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password.")

    # The user object rides along so the frontend doesn't need a second /me
    # call right after signing in.
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return public_user(user)


@router.post("/logout")
async def logout():
    """Kept so the frontend's existing call still works. Nothing to do here —
    the token dies when the client discards it. If you ever need real
    revocation, this is where a denylist would go."""
    return None