import uuid
import pytest

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.models.organizations import Organization
from app.models.bank_accounts import BankAccount
from app.schemas.organizations import OrganizationUpdate
from app.api.v1.endpoints.organizations import update_organization


async def _setup_engine():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


async def _teardown_engine(engine):
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE bank_accounts, organizations CASCADE"))
    await engine.dispose()


@pytest.mark.asyncio
async def test_default_bank_account_rejects_foreign_account():
    engine = await _setup_engine()

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()
    bank_b_id = uuid.uuid4()

    try:
        async with async_session() as db:
            db.add(Organization(id=org_a_id, name="Org A", slug=f"org-a-{org_a_id.hex[:8]}"))
            db.add(Organization(id=org_b_id, name="Org B", slug=f"org-b-{org_b_id.hex[:8]}"))
            await db.commit()
            db.add(
                BankAccount(
                    id=bank_b_id,
                    organization_id=org_b_id,
                    name="Org B Account",
                    balance_cents=0,
                    currency="BRL"
                )
            )
            await db.commit()

            with pytest.raises(HTTPException) as exc:
                await update_organization(
                    organization_id=org_a_id,
                    organization_in=OrganizationUpdate(default_bank_account_id=bank_b_id),
                    organization_id_validated=org_a_id,
                    db=db
                )

            assert exc.value.status_code == 400
            assert "Default bank account" in exc.value.detail
    finally:
        await _teardown_engine(engine)


@pytest.mark.asyncio
async def test_default_bank_account_accepts_own_account():
    engine = await _setup_engine()

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    org_id = uuid.uuid4()
    bank_id = uuid.uuid4()

    try:
        async with async_session() as db:
            db.add(Organization(id=org_id, name="Org", slug=f"org-{org_id.hex[:8]}"))
            await db.commit()
            db.add(
                BankAccount(
                    id=bank_id,
                    organization_id=org_id,
                    name="Org Account",
                    balance_cents=0,
                    currency="BRL"
                )
            )
            await db.commit()

            organization = await update_organization(
                organization_id=org_id,
                organization_in=OrganizationUpdate(default_bank_account_id=bank_id),
                organization_id_validated=org_id,
                db=db
            )

            assert organization.default_bank_account_id == bank_id
    finally:
        await _teardown_engine(engine)
