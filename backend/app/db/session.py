from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from uuid import uuid4

# Create async engine with robust pooling settings to prevent connection drops
# Adjusted to handle potential network latency or cloud DB limits
# Uses NullPool because Supabase Transaction Pooler (PgBouncer) handles pooling.
# SQLAlchemy pooling must be disabled to avoid prepared statement issues.
engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    future=True,
    echo=settings.LOG_LEVEL == "DEBUG",
    poolclass=NullPool,  # Disable SQLAlchemy pooling
    pool_pre_ping=True,
    connect_args={
        "timeout": 60,  # Increase connection timeout to 60s
        # PgBouncer (transaction/statement pooling) is not compatible with prepared statement caching.
        # Disable SQLAlchemy's asyncpg prepared statement cache, and use unique prepared statement names.
        # This prevents DuplicatePreparedStatementError when server connections are reused.
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        # Also disable asyncpg's own statement cache as an extra safety net.
        "statement_cache_size": 0,
        "server_settings": {
            "jit": "off",  # Disable JIT to improve query planning stability
            "application_name": "safetasks-v3"
        }
    }
)
# DEBUG: Verify that code is effectively deployed
print(
    "DEBUG: SafeTasks DB Engine Initialized with NullPool, prepared_statement_cache_size=0, statement_cache_size=0",
    flush=True,
)

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
