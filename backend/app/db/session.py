from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Cria o motor assíncrono usando a URL do config (postgresql+asyncpg)
engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, future=True, echo=True)

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
