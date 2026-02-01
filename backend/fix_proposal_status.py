import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.db.session import SessionLocal
from app.models.proposals import Proposal
from sqlalchemy import select, update

async def fix_proposal_status():
    async with SessionLocal() as db:
        print("\n=== FIXING PROPOSAL STATUS ===")
        
        # Determine the proposal to fix (the one with no project)
        stmt = select(Proposal).where(Proposal.status == 'approved', Proposal.project_id == None)
        result = await db.execute(stmt)
        proposals = result.scalars().all()

        if not proposals:
            print("No broken proposals found.")
            return

        for p in proposals:
            print(f"Reverting Proposal {p.id} ({p.title}) from 'approved' to 'draft'")
            p.status = 'draft'
            db.add(p)
        
        await db.commit()
        print("Done. Please verify in the UI.")

if __name__ == "__main__":
    asyncio.run(fix_proposal_status())
