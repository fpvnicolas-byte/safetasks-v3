import contextvars
import logging
import time

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from uuid import uuid4

logger = logging.getLogger(__name__)

# Per-request DB metrics (used by Server-Timing and slow query logging).
_db_time_ms: contextvars.ContextVar = contextvars.ContextVar("db_time_ms", default=0.0)
_db_query_count: contextvars.ContextVar = contextvars.ContextVar("db_query_count", default=0)


def reset_db_metrics() -> tuple[contextvars.Token, contextvars.Token]:
    """
    Reset per-request DB metrics and return tokens for restoration.
    Use in request middleware to isolate metrics between requests.
    """
    return (_db_time_ms.set(0.0), _db_query_count.set(0))


def restore_db_metrics(tokens: tuple[contextvars.Token, contextvars.Token]) -> None:
    """Restore previous DB metrics values using tokens from reset_db_metrics()."""
    time_token, count_token = tokens
    _db_time_ms.reset(time_token)
    _db_query_count.reset(count_token)


def get_db_metrics() -> tuple[float, int]:
    """Return (db_time_ms, db_query_count) for the current request context."""
    return (_db_time_ms.get(), _db_query_count.get())


# Create async engine with robust pooling settings.
#
# PgBouncer in *transaction* mode is not compatible with asyncpg prepared statement
# caching, so we keep caches disabled. We still use SQLAlchemy client-side pooling
# to reduce socket churn to PgBouncer itself.
_connect_args: dict = {
    "timeout": 60,  # Increase connection timeout to 60s
    "prepared_statement_cache_size": 0,
    "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    "statement_cache_size": 0,
    "server_settings": {
        "jit": "off",
        "application_name": "safetasks-v3",
    },
}
if settings.DB_SSL is not None:
    _connect_args["ssl"] = settings.DB_SSL

engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    future=True,
    echo=settings.LOG_LEVEL == "DEBUG",
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    connect_args=_connect_args,
)

_enable_db_metrics = bool(settings.ENABLE_SERVER_TIMING or settings.LOG_SLOW_QUERIES_MS > 0)


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    if not _enable_db_metrics:
        return
    if context is not None:
        context._query_start_time = time.perf_counter()


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    if not _enable_db_metrics:
        return

    start = getattr(context, "_query_start_time", None)
    if start is None:
        return

    elapsed_ms = (time.perf_counter() - start) * 1000.0
    _db_time_ms.set(_db_time_ms.get() + elapsed_ms)
    _db_query_count.set(_db_query_count.get() + 1)

    threshold_ms = settings.LOG_SLOW_QUERIES_MS
    if threshold_ms and elapsed_ms >= threshold_ms:
        # Log SQL only (no params) to reduce risk of leaking secrets/PII.
        logger.warning("Slow SQL query (%.1f ms): %s", elapsed_ms, statement)

# Cria a fábrica de sessões (Essa é a variável que o script estava procurando com o nome errado)
SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)


async def get_db() -> AsyncSession:
    """
    Dependency to get database session.
    Use with FastAPI's dependency injection:
        async def endpoint(db: AsyncSession = Depends(get_db)):
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
