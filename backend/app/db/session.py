from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create async engine with robust pooling settings to prevent connection drops
# Adjusted to handle potential network latency or cloud DB limits
engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    future=True,
    echo=settings.LOG_LEVEL == "DEBUG",
    pool_pre_ping=True,
    pool_size=5,  # Reduced pool size to prevent overloading
    max_overflow=10,
    pool_recycle=600,  # Recycle every 10 minutes
    connect_args={
        "timeout": 60,  # Increase connection timeout to 60s
        "server_settings": {
            "jit": "off",  # Disable JIT to improve query planning stability
            "application_name": "safetasks-v3"
        }
    }
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
