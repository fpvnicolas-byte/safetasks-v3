#!/usr/bin/env python3
"""
Expense Approval Application Tests

Verifies that:
- New expense transactions start as pending (even if the project budget is approved)
- Pending expenses do not affect bank balances until approved
- Approving an expense applies it to the bank balance
"""

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.bank_accounts import BankAccount
from app.models.clients import Client
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.projects import Project
from app.schemas.transactions import TransactionCreate
from app.services.financial import transaction_service


async def _create_db_session():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_expense_requires_approval_and_applies_balance_on_approval():
    async_session = await _create_db_session()

    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    project_id = uuid.uuid4()
    bank_account_id = uuid.uuid4()
    approver_id = uuid.uuid4()

    async with async_session() as db:
        org = Organization(id=org_id, name="Auto Approve Org", slug=str(org_id)[:12])
        approver = Profile(
            id=approver_id,
            email="approver@test.com",
            organization_id=org_id,
            role="admin",
            role_v2="admin",
        )
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
        db.add_all([org, approver, client, project, bank_account])
        await db.commit()

        # Create an expense within remaining budget ($25.00) - should still be pending
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

        assert tx.payment_status == "pending"

        await db.refresh(bank_account)
        assert bank_account.balance_cents == 0

        # Approve the expense and verify the balance is applied
        from app.api.v1.endpoints.transactions import approve_transaction

        approved_tx = await approve_transaction(
            transaction_id=tx.id,
            organization_id=org_id,
            current_user=approver_id,
            db=db,
        )

        assert approved_tx.payment_status == "approved"
        await db.refresh(bank_account)
        assert bank_account.balance_cents == -2_500
