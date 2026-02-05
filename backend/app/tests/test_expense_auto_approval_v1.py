#!/usr/bin/env python3
"""
Expense Auto-Approval Tests

Verifies that expenses are auto-approved when:
- The project budget is approved
- The expense amount is within the remaining approved budget
"""

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.bank_accounts import BankAccount
from app.models.clients import Client
from app.models.organizations import Organization
from app.models.projects import Project
from app.schemas.transactions import TransactionCreate
from app.services.financial import transaction_service


async def _create_db_session():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_expense_auto_approved_when_budget_approved_and_within_remaining():
    async_session = await _create_db_session()

    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    project_id = uuid.uuid4()
    bank_account_id = uuid.uuid4()

    async with async_session() as db:
        org = Organization(id=org_id, name="Auto Approve Org", slug=str(org_id)[:12])
        client = Client(id=client_id, organization_id=org_id, name="Auto Approve Client")
        project = Project(
            id=project_id,
            organization_id=org_id,
            client_id=client_id,
            title="Auto Approve Project",
            status="production",
            budget_total_cents=50_000,  # $500.00
            budget_status="approved",
        )
        bank_account = BankAccount(
            id=bank_account_id,
            organization_id=org_id,
            name="Auto Approve Account",
            balance_cents=0,
            currency="USD",
        )
        db.add_all([org, client, project, bank_account])
        await db.commit()

        # Create an expense within remaining budget ($25.00)
        tx_in = TransactionCreate(
            bank_account_id=bank_account_id,
            project_id=project_id,
            category="crew_hire",
            type="expense",
            amount_cents=2_500,
            description="Within budget",
            transaction_date=date.today(),
        )

        tx = await transaction_service.create(db=db, organization_id=org_id, obj_in=tx_in)
        await db.commit()

        assert tx.payment_status == "approved"
        assert tx.approved_at is not None
