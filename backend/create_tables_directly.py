#!/usr/bin/env python3
"""
Create all database tables directly using SQLAlchemy.
This bypasses Alembic migration issues.
"""

import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.db.base import Base

async def create_all_tables():
    """Create all tables defined in models."""
    print("🔨 Creating all database tables...")

    # Use begin() context which auto-commits on success
    async with engine.begin() as conn:
        # Drop all tables first
        await conn.run_sync(Base.metadata.drop_all)
        print("✅ Dropped existing tables")

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Created all tables")

        # Commit is automatic when context exits without exception

    # List all created tables
    print(f"\n📊 Created {len(Base.metadata.tables)} tables:")
    for table_name in sorted(Base.metadata.tables.keys()):
        print(f"   - {table_name}")

    # Verify tables exist
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
        tables = [row[0] for row in result]
        print(f"\n✅ Verified {len(tables)} tables in database:")
        for table in sorted(tables):
            print(f"   - {table}")

    await engine.dispose()
    print("\n✅ Database schema created successfully!")

if __name__ == "__main__":
    asyncio.run(create_all_tables())
