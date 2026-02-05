#!/usr/bin/env python3
"""
Project Budget Actuals Tracking Tests

Verifies that:
- Project budget summaries include expenses even when transactions are not linked to a budget line.
- New expense transactions auto-link to an existing budget line when possible.
"""

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.bank_accounts import BankAccount
from app.models.clients import Client
from app.models.financial import BudgetCategoryEnum, ProjectBudgetLine
from app.models.organizations import Organization
from app.models.projects import Project
from app.models.transactions import Transaction
from app.schemas.transactions import TransactionCreate
from app.services.financial import transaction_service


async def _create_db_session():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_budget_summary_includes_unassigned_project_expenses():
    async_session = await _create_db_session()

    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    project_id = uuid.uuid4()
    bank_account_id = uuid.uuid4()

    async with async_session() as db:
        # Base entities
        org = Organization(id=org_id, name="Budget Test Org", slug=str(org_id)[:12])
        client = Client(id=client_id, organization_id=org_id, name="Budget Test Client")
        project = Project(
            id=project_id,
            organization_id=org_id,
            client_id=client_id,
            title="Budget Test Project",
            status="production",
        )
        bank_account = BankAccount(
            id=bank_account_id,
            organization_id=org_id,
            name="Budget Test Account",
            balance_cents=0,
            currency="BRL",
        )
        db.add_all([org, client, project, bank_account])

        # One crew budget line (estimated)
        budget_line = ProjectBudgetLine(
            id=uuid.uuid4(),
            organization_id=org_id,
            project_id=project_id,
            category=BudgetCategoryEnum.CREW,
            description="Crew bucket",
            estimated_amount_cents=500_000,
            sort_order=0,
        )
        db.add(budget_line)

        # Expense transaction NOT linked to a budget line (budget_line_id=None)
        unassigned_expense = Transaction(
            id=uuid.uuid4(),
            organization_id=org_id,
            bank_account_id=bank_account_id,
            project_id=project_id,
            category="crew_hire",
            type="expense",
            amount_cents=120_000,
            description="Unassigned crew expense",
            transaction_date=date.today(),
            budget_line_id=None,
            payment_status="approved",
        )
        db.add(unassigned_expense)
        await db.commit()

        from app.api.v1.endpoints.financial import get_project_budget

        summary = await get_project_budget(
            project_id=project_id,
            organization_id=org_id,
            db=db,
        )

        assert summary.total_estimated_cents == 500_000
        assert summary.total_actual_cents == 120_000

        crew = next((c for c in summary.by_category if c.category.value == "crew"), None)
        assert crew is not None
        assert crew.estimated_cents == 500_000
        assert crew.actual_cents == 120_000


async def test_transaction_service_auto_links_budget_line_by_category():
    async_session = await _create_db_session()

    org_id = uuid.uuid4()
    client_id = uuid.uuid4()
    project_id = uuid.uuid4()
    bank_account_id = uuid.uuid4()

    async with async_session() as db:
        # Base entities
        org = Organization(id=org_id, name="Auto-Link Test Org", slug=str(org_id)[:12])
        client = Client(id=client_id, organization_id=org_id, name="Auto-Link Client")
        project = Project(
            id=project_id,
            organization_id=org_id,
            client_id=client_id,
            title="Auto-Link Project",
            status="production",
        )
        bank_account = BankAccount(
            id=bank_account_id,
            organization_id=org_id,
            name="Auto-Link Account",
            balance_cents=0,
            currency="BRL",
        )
        db.add_all([org, client, project, bank_account])

        # Budget line for crew category
        budget_line = ProjectBudgetLine(
            id=uuid.uuid4(),
            organization_id=org_id,
            project_id=project_id,
            category=BudgetCategoryEnum.CREW,
            description="Crew bucket",
            estimated_amount_cents=500_000,
            sort_order=0,
        )
        db.add(budget_line)
        await db.commit()

        tx_in = TransactionCreate(
            bank_account_id=bank_account_id,
            project_id=project_id,
            category="crew_hire",
            type="expense",
            amount_cents=50_000,
            description="Crew expense (should auto-link)",
            transaction_date=date.today(),
        )

        tx = await transaction_service.create(
            db=db,
            organization_id=org_id,
            obj_in=tx_in,
        )
        await db.commit()

        assert tx.budget_line_id == budget_line.id
