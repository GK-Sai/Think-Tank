"""The async engine and the per-request session."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,   # a connection dropped by the server is replaced, not raised
    connect_args={
        # asyncpg caches a prepared plan per connection. Run a migration while
        # uvicorn is up — which is exactly what `alembic upgrade head` in the
        # other terminal is — and every pooled connection answers the next
        # request with "cached statement plan is invalid", i.e. a 500 the
        # developer did nothing to cause. Turning the cache off costs a
        # fraction of a millisecond per query at this size and means the API
        # survives a schema change without being restarted.
        "prepared_statement_cache_size": 0,
    },
)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,   # keeps loaded objects usable after commit()
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """
    FastAPI dependency: one session per request.

    Routes commit deliberately; anything that escapes uncommitted is rolled
    back here rather than half-written.
    """
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
