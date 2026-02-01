import asyncio
import os
import sys

# Add backend directory to python path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.db.session import SessionLocal
from app.models.proposals import Proposal
from app.models.projects import Project
from app.models.clients import Client
from sqlalchemy import select, func

async def audit_proposals():
    async with SessionLocal() as db:
        print("\n=== PROPOSAL AUDIT ===")
        
        # 1. Count Total Proposals
        total_proposals = await db.scalar(select(func.count(Proposal.id)))
        print(f"Total Proposals in DB: {total_proposals}")

        # 2. List Proposals with Client and Project info
        result = await db.execute(select(Proposal))
        proposals = result.scalars().all()

        print(f"\nListing {len(proposals)} fetched proposals:")
        print(f"{'ID':<38} | {'Title':<20} | {'Status':<10} | {'Client ID':<38} | {'Project ID':<38} | {'Amount':<10}")
        print("-" * 160)
        
        for p in proposals:
            client = await db.get(Client, p.client_id)
            client_name = client.name if client else "MISSING"
            
            project_budget = "N/A"
            if p.project_id:
                project = await db.get(Project, p.project_id)
                project_budget = project.budget_total_cents if project else "MISSING"

            # Check services
            service_names = [s.name for s in p.services]
            
            print(f"{str(p.id):<38} | {p.title[:20]:<20} | {p.status:<10} | {str(p.client_id)} ({client_name}) | {str(p.project_id) if p.project_id else 'None':<38} (Budget: {project_budget}) | {p.total_amount_cents}")
            print(f"   Services: {service_names}")

        # 3. Check for specific discrepancies
        print("\n=== DISCREPANCY CHECK ===")
        for p in proposals:
            if not p.client_id:
                 print(f"[ERROR] Proposal {p.id} ({p.title}) has NO client_id")
            else:
                client = await db.get(Client, p.client_id)
                if not client:
                    print(f"[ERROR] Proposal {p.id} ({p.title}) links to non-existent client {p.client_id}")
            
            if p.project_id:
                project = await db.get(Project, p.project_id)
                if project and project.budget_total_cents == 0 and p.total_amount_cents > 0:
                     print(f"[WARNING] Proposal {p.id} ({p.title}) has amount {p.total_amount_cents} but Project {project.id} has budget 0")

if __name__ == "__main__":
    asyncio.run(audit_proposals())
