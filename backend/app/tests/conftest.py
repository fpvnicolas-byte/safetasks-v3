import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.fixture(autouse=True)
async def _truncate_public_schema():
    """Ensure each app/tests test runs with a clean public schema."""
    uri = os.getenv("SQLALCHEMY_DATABASE_URI")
    if not uri:
        yield
        return

    engine = create_async_engine(uri, echo=False)
    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        tables = [row[0] for row in result]
        if tables:
            quoted = ", ".join(f'"{name}"' for name in tables)
            await conn.execute(text(f"TRUNCATE TABLE {quoted} CASCADE"))

    await engine.dispose()
    yield
