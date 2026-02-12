import asyncio
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.organizations import Organization

async def list_orgs():
    async with SessionLocal() as db:
        query = select(Organization).limit(5)
        result = await db.execute(query)
        orgs = result.scalars().all()
        
        print("\n--- Organizations ---")
        for o in orgs:
            print(f"ID: {o.id} | Name: {o.name}")
        print("---------------------\n")

if __name__ == "__main__":
    asyncio.run(list_orgs())
