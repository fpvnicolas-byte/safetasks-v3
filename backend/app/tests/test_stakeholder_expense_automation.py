#!/usr/bin/env python3
"""
Stakeholder Expense Automation Tests
Tests automatic expense creation when stakeholders are confirmed
"""

import asyncio
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.bank_accounts import BankAccount
from app.models.clients import Client
from app.models.projects import Project
from app.models.transactions import Transaction
from app.models.commercial import Stakeholder, StakeholderStatusEnum
from app.models.scheduling import ShootingDay
from app.services.financial import bank_account_service, transaction_service
from app.schemas.bank_accounts import BankAccountCreate


async def setup_test_data():
    """Create test organization, project, and stakeholders for expense automation testing"""
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create Organization
        org = Organization(
            id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            name="Test Production Company",
            slug="test-production-company"
        )
        db.add(org)
        await db.flush()

        # Create default bank account
        bank_account = BankAccount(
            id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            organization_id=org.id,
            name="Conta Principal",
            balance_cents=0,
            currency="BRL"
        )
        db.add(bank_account)
        await db.flush()

        # Set as default
        org.default_bank_account_id = bank_account.id
        db.add(org)

        # Create Client
        client = Client(
            id=uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            organization_id=org.id,
            name="Test Client",
            email="client@test.com"
        )
        db.add(client)

        # Create Project
        project = Project(
            id=uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            organization_id=org.id,
            client_id=client.id,
            title="Test Commercial",
            status="pre-production"
        )
        db.add(project)

        # Create shooting days for the project
        for i in range(3):
            shooting_day = ShootingDay(
                id=uuid.uuid4(),
                organization_id=org.id,
                project_id=project.id,
                date=date(2024, 6, 10 + i),
                call_time="08:00"
            )
            db.add(shooting_day)

        await db.commit()

    return async_session


async def test_expense_creation_daily_rate():
    """Test expense created when stakeholder confirmed with daily rate"""
    print("\n💰 Test 1: Expense creation with daily rate\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder with daily rate
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="John DP",
                role="Director of Photography",
                rate_type="daily",
                rate_value_cents=250000,  # R$ 2,500/day
                estimated_units=3,  # 3 days
                status=StakeholderStatusEnum.REQUESTED
            )
            db.add(stakeholder)
            await db.commit()

            # Create expense using transaction service
            transaction = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=3
            )
            await db.commit()

            # Verify transaction
            expected_amount = 250000 * 3  # R$ 7,500
            assert transaction.amount_cents == expected_amount, \
                f"Expected {expected_amount}, got {transaction.amount_cents}"
            assert transaction.type == "expense"
            assert transaction.category == "crew_hire"
            assert transaction.stakeholder_id == stakeholder.id
            assert transaction.project_id == project_id

            print(f"✅ Created expense: R$ {transaction.amount_cents / 100:.2f}")
            print(f"   Rate: R$ 2,500/day × 3 days = R$ 7,500")

            # Verify bank balance was updated
            result = await db.execute(
                select(BankAccount).where(BankAccount.id == uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"))
            )
            account = result.scalar_one()
            assert account.balance_cents == -expected_amount, \
                f"Expected balance -{expected_amount}, got {account.balance_cents}"
            print(f"✅ Bank balance updated: R$ {account.balance_cents / 100:.2f}")

        finally:
            await db.close()


async def test_expense_creation_hourly_rate():
    """Test expense created when stakeholder confirmed with hourly rate"""
    print("\n⏰ Test 2: Expense creation with hourly rate\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder with hourly rate
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="Jane Sound",
                role="Sound Operator",
                rate_type="hourly",
                rate_value_cents=15000,  # R$ 150/hour
                estimated_units=24,  # 24 hours total
                status=StakeholderStatusEnum.REQUESTED
            )
            db.add(stakeholder)
            await db.commit()

            # Create expense
            transaction = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=3
            )
            await db.commit()

            # Verify
            expected_amount = 15000 * 24  # R$ 3,600
            assert transaction.amount_cents == expected_amount
            print(f"✅ Created expense: R$ {transaction.amount_cents / 100:.2f}")
            print(f"   Rate: R$ 150/hour × 24 hours = R$ 3,600")

        finally:
            await db.close()


async def test_expense_creation_fixed_rate():
    """Test expense created when stakeholder confirmed with fixed rate"""
    print("\n💵 Test 3: Expense creation with fixed rate\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder with fixed rate
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="Bob Producer",
                role="Line Producer",
                rate_type="fixed",
                rate_value_cents=1500000,  # R$ 15,000 total
                status=StakeholderStatusEnum.REQUESTED
            )
            db.add(stakeholder)
            await db.commit()

            # Create expense
            transaction = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=3
            )
            await db.commit()

            # Verify
            assert transaction.amount_cents == 1500000
            print(f"✅ Created expense: R$ {transaction.amount_cents / 100:.2f}")
            print(f"   Fixed rate: R$ 15,000")

        finally:
            await db.close()


async def test_no_expense_without_rate():
    """Test no expense when rate not configured"""
    print("\n🚫 Test 4: No expense when rate not configured\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder without rate
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="No Rate Person",
                role="Intern",
                rate_type=None,
                rate_value_cents=None,
                status=StakeholderStatusEnum.REQUESTED
            )
            db.add(stakeholder)
            await db.commit()

            # Attempt to create expense should fail
            try:
                await transaction_service.create_expense_from_stakeholder(
                    db=db,
                    organization_id=org_id,
                    stakeholder=stakeholder,
                    shooting_days_count=3
                )
                print("❌ Should have raised ValueError")
                assert False, "Should have raised ValueError"
            except ValueError as e:
                print(f"✅ Correctly raised ValueError: {e}")

        finally:
            await db.close()


async def test_no_duplicate_expense():
    """Test no duplicate expense on re-confirmation"""
    print("\n🔄 Test 5: No duplicate expense on re-confirmation\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="Double Check",
                role="Gaffer",
                rate_type="daily",
                rate_value_cents=200000,
                estimated_units=2,
                status=StakeholderStatusEnum.REQUESTED
            )
            db.add(stakeholder)
            await db.commit()

            # First expense creation
            transaction1 = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=2
            )
            await db.commit()

            # Second attempt - should return same transaction
            transaction2 = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=2
            )

            # Verify same transaction returned
            assert transaction1.id == transaction2.id, "Should return same transaction"
            print(f"✅ Idempotency verified: same transaction returned")

            # Verify only one transaction exists
            result = await db.execute(
                select(Transaction).where(Transaction.stakeholder_id == stakeholder.id)
            )
            transactions = result.scalars().all()
            assert len(transactions) == 1, f"Expected 1 transaction, got {len(transactions)}"
            print(f"✅ Only 1 transaction exists for stakeholder")

        finally:
            await db.close()


async def test_confirmed_rate_takes_precedence():
    """Test that confirmed rate takes precedence over original rate"""
    print("\n✨ Test 6: Confirmed rate takes precedence\n")

    async_session = await setup_test_data()
    org_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    project_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

    async with async_session() as db:
        try:
            # Create stakeholder with negotiated rate
            stakeholder = Stakeholder(
                id=uuid.uuid4(),
                organization_id=org_id,
                project_id=project_id,
                name="Negotiator",
                role="Director",
                rate_type="daily",
                rate_value_cents=300000,  # Original: R$ 3,000/day
                estimated_units=3,
                confirmed_rate_type="daily",
                confirmed_rate_cents=350000,  # Confirmed: R$ 3,500/day
                status=StakeholderStatusEnum.CONFIRMED
            )
            db.add(stakeholder)
            await db.commit()

            # Create expense
            transaction = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=org_id,
                stakeholder=stakeholder,
                shooting_days_count=3
            )
            await db.commit()

            # Should use confirmed rate, not original
            expected_amount = 350000 * 3  # R$ 10,500 (not R$ 9,000)
            assert transaction.amount_cents == expected_amount, \
                f"Expected {expected_amount} (confirmed), got {transaction.amount_cents}"
            print(f"✅ Used confirmed rate: R$ {transaction.amount_cents / 100:.2f}")
            print(f"   Original would be: R$ {300000 * 3 / 100:.2f}")
            print(f"   Confirmed rate: R$ 3,500/day × 3 = R$ 10,500")

        finally:
            await db.close()


if __name__ == "__main__":
    print("🧪 Starting Stakeholder Expense Automation Tests\n")
    print("=" * 60)

    asyncio.run(test_expense_creation_daily_rate())
    asyncio.run(test_expense_creation_hourly_rate())
    asyncio.run(test_expense_creation_fixed_rate())
    asyncio.run(test_no_expense_without_rate())
    asyncio.run(test_no_duplicate_expense())
    asyncio.run(test_confirmed_rate_takes_precedence())

    print("\n" + "=" * 60)
    print("🎉 All Stakeholder Expense Automation Tests Completed!")
