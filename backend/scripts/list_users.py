import asyncio
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.profiles import Profile

async def list_users():
    async with SessionLocal() as db:
        query = select(Profile).limit(20)
        result = await db.execute(query)
        profiles = result.scalars().all()
        
        print("\n--- User Profiles ---")
        for p in profiles:
            print(f"ID: {p.id} | Email: {p.email} | Name: {p.full_name}")
        print("---------------------\n")

if __name__ == "__main__":
    asyncio.run(list_users())
