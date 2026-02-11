
import asyncio
import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.db.session import SessionLocal

async def main():
    try:
        async with SessionLocal() as session:
            print("Connecting to database...")
            result = await session.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            tables = sorted([row[0] for row in result.fetchall()])
            print(f"Tables in public ({len(tables)}):")
            for t in tables:
                print(f" - {t}")
            
            if 'organizations' in tables:
                print("\nChecking columns in 'organizations':")
                cols = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations'"))
                print(sorted([r[0] for r in cols.fetchall()]))
            else:
                print("\n'organizations' table NOT FOUND.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
