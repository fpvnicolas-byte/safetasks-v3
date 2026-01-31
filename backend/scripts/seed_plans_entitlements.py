#!/usr/bin/env python3
"""Seed plans and entitlements (Phase 3)."""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.billing import Plan, Entitlement

GB = 1024 * 1024 * 1024

PLANS = [
    {
        "name": "starter",
        "billing_interval": "monthly",
        "stripe_price_id": "price_1SmKRMQBou9YDSD2HPqUgldI",
        "is_custom": False,
        "entitlements": {
            "max_projects": 5,
            "max_clients": 20,
            "max_proposals": 20,
            "max_users": 5,
            "max_storage_bytes": 25 * GB,
            "ai_credits": 100,
        },
    },
    {
        "name": "pro",
        "billing_interval": "monthly",
        "stripe_price_id": "price_1SpDHYQBou9YDSD2wu8zH3rt",
        "is_custom": False,
        "entitlements": {
            "max_projects": None,
            "max_clients": None,
            "max_proposals": None,
            "max_users": None,
            "max_storage_bytes": 50 * GB,
            "ai_credits": 1000,
        },
    },
    {
        "name": "pro_annual",
        "billing_interval": "annual",
        "stripe_price_id": "price_1SpDYvQBou9YDSD2YsG88KQa",
        "is_custom": False,
        "entitlements": {
            "max_projects": None,
            "max_clients": None,
            "max_proposals": None,
            "max_users": None,
            "max_storage_bytes": 75 * GB,
            "ai_credits": 2000,
        },
    },
    {
        "name": "enterprise",
        "billing_interval": None,
        "stripe_price_id": None,
        "is_custom": True,
        "entitlements": {
            "max_projects": None,
            "max_clients": None,
            "max_proposals": None,
            "max_users": None,
            "max_storage_bytes": None,
            "ai_credits": None,
        },
    },
    {
        "name": "pro_trial",
        "billing_interval": None,
        "stripe_price_id": None,
        "is_custom": True,
        "entitlements": {
            "max_projects": 1,
            "max_clients": 5,
            "max_proposals": 3,
            "max_users": 2,
            "max_storage_bytes": 5 * GB,
            "ai_credits": 50,
        },
    },
]


async def upsert_plan(db: AsyncSession, data: dict) -> Plan:
    query = select(Plan).where(Plan.name == data["name"])
    result = await db.execute(query)
    plan = result.scalar_one_or_none()

    if plan:
        plan.billing_interval = data["billing_interval"]
        plan.stripe_price_id = data["stripe_price_id"]
        plan.is_custom = data["is_custom"]
    else:
        plan = Plan(
            name=data["name"],
            billing_interval=data["billing_interval"],
            stripe_price_id=data["stripe_price_id"],
            is_custom=data["is_custom"],
        )
        db.add(plan)
        await db.flush()
        await db.refresh(plan)

    return plan


async def upsert_entitlement(db: AsyncSession, plan: Plan, ent: dict) -> Entitlement:
    query = select(Entitlement).where(Entitlement.plan_id == plan.id)
    result = await db.execute(query)
    entitlement = result.scalar_one_or_none()

    if entitlement:
        for field, value in ent.items():
            setattr(entitlement, field, value)
    else:
        entitlement = Entitlement(plan_id=plan.id, **ent)
        db.add(entitlement)

    return entitlement


async def main() -> None:
    async with SessionLocal() as db:
        for plan_data in PLANS:
            plan = await upsert_plan(db, plan_data)
            await upsert_entitlement(db, plan, plan_data["entitlements"])

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
