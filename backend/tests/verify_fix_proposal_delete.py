import sys
import os
from unittest.mock import MagicMock

# Mock app.core.config to avoid permission errors with .env
# and to provide necessary settings for the test
config_mock = MagicMock()
settings_mock = MagicMock()
# Try interacting with localhost/safetasks without specific user (peer auth) or assume current user
settings_mock.SQLALCHEMY_DATABASE_URI = "postgresql+asyncpg://localhost/safetasks"
settings_mock.FINANCIAL_AUTOMATION_ENABLED = True
settings_mock.LOG_LEVEL = "INFO"
config_mock.settings = settings_mock
sys.modules['app.core.config'] = config_mock

sys.path.append(os.getcwd())

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import update

from app.core.config import settings
from app.models.organizations import Organization
from app.models.clients import Client
from app.models.proposals import Proposal
from app.models.financial import Invoice
from app.modules.commercial.service import proposal_service
from app.schemas.proposals import ProposalCreate

async def verify_fix():
    print("🚀 Starting Verification Script")
    
    # Setup
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("📝 Setting up test data...")
        # 1. Create Org
        org_id = uuid.uuid4()
        org = Organization(id=org_id, name="Test Org", slug=f"test-org-{uuid.uuid4()}")
        db.add(org)
        
        # 2. Create Client
        client_id = uuid.uuid4()
        client = Client(id=client_id, organization_id=org_id, name="Test Client", email="test@client.com")
        db.add(client)
        await db.flush()

        # 3. Create Proposal
        proposal_create = ProposalCreate(
            client_id=client_id,
            title="Test Proposal",
            description="to be deleted",
            valid_until="2024-12-31",
            total_amount_cents=10000
        )
        
        # We need to manually create it or use service. 
        # Using service is better but we need to bypass some auth checks potentially? 
        # The service checks client ownership.
        
        proposal = await proposal_service.create(
            db=db,
            organization_id=org_id,
            obj_in=proposal_create
        )
        print(f"✅ Proposal created: {proposal.id}")
        
        # 4. Create Invoice linked to Proposal
        invoice = Invoice(
            organization_id=org_id,
            client_id=client_id,
            proposal_id=proposal.id,
            invoice_number=f"INV-{uuid.uuid4()}",
            subtotal_cents=10000,
            total_amount_cents=10000,
            due_date="2024-12-31"
        )
        db.add(invoice)
        await db.commit()
        print(f"✅ Invoice created linked to proposal: {invoice.id}")
        
        # 5. Try to delete Proposal
        print("🗑️ Attempting to delete proposal...")
        try:
            from sqlalchemy import select
            # Verify link exists
            result = await db.execute(select(Invoice).where(Invoice.id == invoice.id))
            inv = result.scalar_one()
            assert inv.proposal_id == proposal.id
            print("   (Verified invoice is linked)")

            await proposal_service.remove(db=db, organization_id=org_id, id=proposal.id)
            print("✅ Proposal deleted successfully!")
            
            # 6. Verify Invoice still exists and link is null
            db.expire_all()
            result = await db.execute(select(Invoice).where(Invoice.id == invoice.id))
            inv_after = result.scalar_one()
            
            if inv_after.proposal_id is None:
                print("✅ Verified: Invoice.proposal_id is NULL")
            else:
                print(f"❌ FAILED: Invoice.proposal_id is {inv_after.proposal_id}")

        except Exception as e:
            print(f"❌ FAILED with error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(verify_fix())
    except Exception as e:
        print(f"Fatal error: {e}")
