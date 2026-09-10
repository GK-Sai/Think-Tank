"""
Passwords, the access token, and "who is calling".

The session is a JWT the client holds and sends back as
`Authorization: Bearer <token>` on every request. The frontend stores it after
login and attaches it itself — nothing is set on the response, and there is no
cookie to configure, scope to a domain, or clear on logout.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Role, User

# --- passwords -----------------------------------------------------------


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # A malformed hash in the row is a failed login, not a 500.
        return False


# --- the token -----------------------------------------------------------


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.session_days)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


# Old name, kept so nothing that still imports it breaks.
make_token = create_access_token


# --- who is calling ------------------------------------------------------

# auto_error=False so a missing header lands in our own 401 below with a
# message the frontend can show, rather than FastAPI's bare "Not authenticated".
bearer_scheme = HTTPBearer(auto_error=False)

UNAUTHENTICATED = {"WWW-Authenticate": "Bearer"}


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    """
    The signed-in user, or 401.

    Also stamps `last_seen_at`, which is what drives the online dot beside a
    name: "online" here means "was doing something in this app a moment ago".
    """
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Not signed in", headers=UNAUTHENTICATED
        )

    try:
        payload = jwt.decode(
            creds.credentials, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your session has expired. Sign in again.",
            headers=UNAUTHENTICATED,
        )

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "That account no longer exists",
            headers=UNAUTHENTICATED,
        )

    user.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return user


async def require_chairman(user: User = Depends(current_user)) -> User:
    """For the moves that are the chairman's alone."""
    if user.role != Role.chairman:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the chairman can do that")
    return user