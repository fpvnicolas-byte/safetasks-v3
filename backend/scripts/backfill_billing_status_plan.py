#!/usr/bin/env python3
"""Backfill billing_status and plan_id for existing organizations."""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.organizations import Organization
from app.models.billing import Plan

PLAN_MAP = {
    "starter": "starter",
    "professional": "professional",
    "enterprise": "enterprise",
}

STATUS_MAP = {
    "trialing": "trial_active",
    "active": "active",
    "past_due": "past_due",
    "cancelled": "canceled",
    "paused": "past_due",
}


async def get_plan_id(db: AsyncSession, plan_name: str):
    query = select(Plan).where(Plan.name == plan_name)
    result = await db.execute(query)
    plan = result.scalar_one_or_none()
    return plan.id if plan else None


async def main() -> None:
    async with SessionLocal() as db:
        query = select(Organization)
        result = await db.execute(query)
        orgs = result.scalars().all()

        for org in orgs:
            # Backfill billing_status
            if not org.billing_status:
                org.billing_status = STATUS_MAP.get(org.subscription_status, "active")

            # Backfill plan_id if missing
            if not org.plan_id:
                plan_key = PLAN_MAP.get(org.plan)
                if plan_key:
                    plan_id = await get_plan_id(db, plan_key)
                    if plan_id:
                        org.plan_id = plan_id

            db.add(org)

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
