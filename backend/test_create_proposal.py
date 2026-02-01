import asyncio
import uuid
import os
from dotenv import load_dotenv

# Load env vars from backend/.env
load_dotenv("backend/.env")

from datetime import date
from app.db.session import SessionLocal
from app.api.deps import get_db
from app.modules.commercial.service import proposal_service
from app.schemas.proposals import ProposalCreate

async def test_create_proposal():
    async with SessionLocal() as db:
        # 1. Get an organization (assuming one exists)
        from sqlalchemy import text
        result = await db.execute(text("SELECT id FROM organizations LIMIT 1"))
        org_id = result.scalar()
        if not org_id:
            print("No organization found")
            return

        # 2. Get a client
        result = await db.execute(text(f"SELECT id FROM clients WHERE organization_id = '{org_id}' LIMIT 1"))
        client_id = result.scalar()
        if not client_id:
            # Create a client if none exists
            from app.schemas.clients import ClientCreate
            from app.modules.commercial.service import client_service
            client = await client_service.create(db, organization_id=org_id, obj_in=ClientCreate(name="Test Client"))
            client_id = client.id
            print(f"Created test client: {client_id}")

        # 3. Get a service (optional)
        result = await db.execute(text(f"SELECT id FROM services WHERE organization_id = '{org_id}' LIMIT 1"))
        service_id = result.scalar()
        service_ids = [service_id] if service_id else []
        print(f"Using service_id: {service_id}")

        # 4. Create Proposal
        proposal_in = ProposalCreate(
            client_id=client_id,
            title="Crash Test Proposal",
            description="Testing for crash",
            status="draft",
            total_amount_cents=10000,
            currency="USD",
            service_ids=service_ids
        )

        print("Attempting to create proposal...")
        try:
            proposal = await proposal_service.create(
                db=db,
                organization_id=org_id,
                obj_in=proposal_in
            )
            print(f"SUCCESS! Proposal created: {proposal.id}")
            print(f"Project ID: {proposal.project_id}")
            print(f"Client ID: {proposal.client_id}")
            print(f"Services: {[s.id for s in proposal.services]}")
        except Exception as e:
            print(f"CRASHED: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_create_proposal())
