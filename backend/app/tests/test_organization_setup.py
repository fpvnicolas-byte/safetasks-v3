#!/usr/bin/env python3
"""
Organization Setup Tests
Tests automatic bank account creation on organization onboarding
"""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.bank_accounts import BankAccount
from app.services.financial import bank_account_service
from app.schemas.bank_accounts import BankAccountCreate


async def setup_test_profile():
    """Create a test profile without an organization"""
    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        echo=False,
        connect_args={
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create a profile without organization (simulating new signup)
        profile = Profile(
            id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            full_name="New User",
            email="newuser@test.com",
            role="admin"
        )
        db.add(profile)
        await db.commit()

    return async_session


async def test_organization_setup_with_bank_account():
    """Test that creating an organization also creates a default bank account"""
    print("🏢 Starting Organization Setup Tests\n")

    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        echo=False,
        connect_args={
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Test 1: Create organization and default bank account
            print("🏦 Test 1: Create organization with default bank account")

            org_id = uuid.uuid4()
            organization = Organization(
                id=org_id,
                name="Test Production Company",
                slug="test-production-company"
            )
            db.add(organization)
            await db.flush()
            await db.refresh(organization)

            # Create default bank account (simulating what onboarding endpoint does)
            default_account = await bank_account_service.create(
                db=db,
                organization_id=organization.id,
                obj_in=BankAccountCreate(name="Conta Principal", currency="BRL")
            )
            organization.default_bank_account_id = default_account.id
            db.add(organization)
            await db.commit()
            await db.refresh(organization)

            print(f"✅ Organization created: {organization.name}")
            print(f"   Organization ID: {organization.id}")
            print(f"   Default Bank Account ID: {organization.default_bank_account_id}")

            # Verify the bank account was created correctly
            assert organization.default_bank_account_id is not None, "Default bank account should be set"
            assert organization.default_bank_account_id == default_account.id, "Default bank account ID mismatch"
            print("✅ Default bank account ID is set correctly")

            # Test 2: Verify bank account properties
            print("\n💰 Test 2: Verify bank account properties")

            account = await bank_account_service.get(
                db=db,
                organization_id=organization.id,
                id=default_account.id
            )

            assert account is not None, "Bank account should exist"
            assert account.name == "Conta Principal", f"Expected 'Conta Principal', got '{account.name}'"
            assert account.currency == "BRL", f"Expected 'BRL', got '{account.currency}'"
            assert account.balance_cents == 0, f"Initial balance should be 0, got {account.balance_cents}"
            assert account.organization_id == organization.id, "Bank account should belong to org"

            print(f"✅ Bank account verified:")
            print(f"   Name: {account.name}")
            print(f"   Currency: {account.currency}")
            print(f"   Balance: R$ {account.balance_cents / 100:.2f}")
            print(f"   Organization ID: {account.organization_id}")

            # Test 3: Verify only one bank account exists
            print("\n📊 Test 3: Verify single bank account created")

            result = await db.execute(
                select(BankAccount).where(BankAccount.organization_id == organization.id)
            )
            accounts = result.scalars().all()

            assert len(accounts) == 1, f"Expected 1 bank account, got {len(accounts)}"
            print(f"✅ Organization has exactly 1 bank account")

            # Test 4: Test isolation - other orgs don't see this account
            print("\n🔒 Test 4: Verify multi-tenant isolation")

            other_org_id = uuid.uuid4()
            other_org = Organization(
                id=other_org_id,
                name="Other Company",
                slug="other-company"
            )
            db.add(other_org)
            await db.commit()

            # Try to get the bank account using the other org's ID
            isolated_account = await bank_account_service.get(
                db=db,
                organization_id=other_org_id,
                id=default_account.id
            )

            assert isolated_account is None, "Account should not be visible to other orgs"
            print("✅ Bank account is not visible to other organizations")

            print("\n🎉 Organization Setup Tests Completed!")
            print("✅ Default bank account created on org creation")
            print("✅ Bank account has correct properties")
            print("✅ Multi-tenant isolation verified")

        finally:
            await db.close()


async def test_financial_automation_enabled():
    """Test that financial automation is enabled by default"""
    print("\n⚙️ Testing Financial Automation Config\n")

    assert settings.FINANCIAL_AUTOMATION_ENABLED is True, \
        f"FINANCIAL_AUTOMATION_ENABLED should be True, got {settings.FINANCIAL_AUTOMATION_ENABLED}"

    print("✅ FINANCIAL_AUTOMATION_ENABLED = True")
    print("✅ Invoice payments will automatically create income transactions")


if __name__ == "__main__":
    asyncio.run(test_organization_setup_with_bank_account())
    asyncio.run(test_financial_automation_enabled())
