import os
from uuid import uuid4

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

    engine = create_async_engine(
        uri,
        echo=False,
        connect_args={
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        # Keep alembic metadata intact so migration tooling continues to work
        # after test runs on shared test databases.
        tables = [row[0] for row in result if row[0] != "alembic_version"]
        if tables:
            quoted = ", ".join(f'"{name}"' for name in tables)
            await conn.execute(text(f"TRUNCATE TABLE {quoted} CASCADE"))

    await engine.dispose()
    yield
