
import asyncio
import sys
from pathlib import Path
from uuid import UUID

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal
from app.models.bank_accounts import BankAccount
from app.models.profiles import Profile
from sqlalchemy import select

async def check_bank_accounts():
    async with SessionLocal() as db:
        # Get first profile to find an active organization
        result = await db.execute(select(Profile).limit(1))
        profile = result.scalars().first()

        if not profile:
            print("❌ No profiles found.")
            return

        print(f"👤 User: {profile.email}")
        print(f"🏢 Organization ID: {profile.organization_id}")

        if not profile.organization_id:
            print("⚠️ User has no organization.")
            return

        # Check bank accounts
        query = select(BankAccount).where(BankAccount.organization_id == profile.organization_id)
        result = await db.execute(query)
        accounts = result.scalars().all()

        print(f"\nFound {len(accounts)} bank accounts:")
        for acc in accounts:
            print(f" - [{acc.id}] {acc.name} ({acc.currency}) Balance: {acc.balance_cents}")

if __name__ == "__main__":
    asyncio.run(check_bank_accounts())
