#!/usr/bin/env python3
"""Recompute usage counters for all organizations."""
import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.organizations import Organization
from app.models.projects import Project
from app.models.clients import Client
from app.models.proposals import Proposal
from app.models.profiles import Profile
from app.models.billing import OrganizationUsage


async def get_or_create_usage(db: AsyncSession, org_id):
    query = select(OrganizationUsage).where(OrganizationUsage.org_id == org_id)
    result = await db.execute(query)
    usage = result.scalar_one_or_none()
    if usage:
        return usage
    usage = OrganizationUsage(org_id=org_id)
    db.add(usage)
    await db.flush()
    await db.refresh(usage)
    return usage


async def main() -> None:
    async with SessionLocal() as db:
        orgs = (await db.execute(select(Organization))).scalars().all()

        for org in orgs:
            projects_count = (await db.execute(select(func.count(Project.id)).where(Project.organization_id == org.id))).scalar() or 0
            clients_count = (await db.execute(select(func.count(Client.id)).where(Client.organization_id == org.id))).scalar() or 0
            proposals_count = (await db.execute(select(func.count(Proposal.id)).where(Proposal.organization_id == org.id))).scalar() or 0
            users_count = (await db.execute(select(func.count(Profile.id)).where(Profile.organization_id == org.id))).scalar() or 0

            usage = await get_or_create_usage(db, org.id)
            usage.projects_count = projects_count
            usage.clients_count = clients_count
            usage.proposals_count = proposals_count
            usage.users_count = users_count
            db.add(usage)

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
