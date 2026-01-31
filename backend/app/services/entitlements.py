from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.billing import Entitlement, OrganizationUsage
from app.models.organizations import Organization


async def get_entitlement(db: AsyncSession, organization: Organization) -> Entitlement | None:
    if not organization.plan_id:
        return None
    query = select(Entitlement).where(Entitlement.plan_id == organization.plan_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


def _limit_error(resource: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=f"Plan limit reached for {resource}. Please upgrade your plan."
    )


async def ensure_resource_limit(
    db: AsyncSession,
    organization: Organization,
    *,
    resource: str,
    current_count: int
) -> None:
    entitlement = await get_entitlement(db, organization)
    if not entitlement:
        return

    limit_map = {
        "projects": entitlement.max_projects,
        "clients": entitlement.max_clients,
        "proposals": entitlement.max_proposals,
        "users": entitlement.max_users,
    }
    limit = limit_map.get(resource)
    if limit is None:
        return
    if current_count >= limit:
        raise _limit_error(resource)


async def _get_or_create_usage(db: AsyncSession, organization_id: UUID) -> OrganizationUsage:
    query = select(OrganizationUsage).where(OrganizationUsage.org_id == organization_id)
    result = await db.execute(query)
    usage = result.scalar_one_or_none()
    if usage:
        return usage
    usage = OrganizationUsage(org_id=organization_id)
    db.add(usage)
    await db.flush()
    await db.refresh(usage)
    return usage


async def ensure_storage_capacity(
    db: AsyncSession,
    organization: Organization,
    *,
    bytes_to_add: int
) -> None:
    entitlement = await get_entitlement(db, organization)
    if not entitlement or entitlement.max_storage_bytes is None:
        return

    usage = await _get_or_create_usage(db, organization.id)
    if usage.storage_bytes_used + bytes_to_add > entitlement.max_storage_bytes:
        raise _limit_error("storage")


async def increment_storage_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    bytes_added: int
) -> None:
    usage = await _get_or_create_usage(db, organization_id)
    usage.storage_bytes_used = (usage.storage_bytes_used or 0) + bytes_added
    db.add(usage)


async def decrement_storage_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    bytes_removed: int
) -> None:
    usage = await _get_or_create_usage(db, organization_id)
    current = usage.storage_bytes_used or 0
    usage.storage_bytes_used = max(0, current - bytes_removed)
    db.add(usage)


async def ensure_ai_credits(
    db: AsyncSession,
    organization: Organization,
    *,
    credits_to_add: int = 1
) -> None:
    entitlement = await get_entitlement(db, organization)
    if not entitlement or entitlement.ai_credits is None:
        return

    usage = await _get_or_create_usage(db, organization.id)
    if usage.ai_credits_used + credits_to_add > entitlement.ai_credits:
        raise _limit_error("AI credits")


async def increment_ai_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    credits_added: int = 1
) -> None:
    usage = await _get_or_create_usage(db, organization_id)
    usage.ai_credits_used = (usage.ai_credits_used or 0) + credits_added
    db.add(usage)
