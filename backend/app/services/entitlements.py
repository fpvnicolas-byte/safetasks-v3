from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.models.billing import Entitlement, OrganizationUsage
from app.models.clients import Client
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.projects import Project
from app.models.proposals import Proposal


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
    # Check pending objects in the current session first to avoid duplicate inserts
    pending = getattr(db, "new", None)
    if pending is None:
        pending = db.sync_session.new
    for obj in pending:
        if isinstance(obj, OrganizationUsage) and obj.org_id == organization_id:
            return obj

    identity_map = getattr(db, "identity_map", None)
    if identity_map is None:
        identity_map = db.sync_session.identity_map
    for obj in identity_map.values():
        if isinstance(obj, OrganizationUsage) and obj.org_id == organization_id:
            return obj

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


async def _lock_usage_row(db: AsyncSession, organization_id: UUID) -> OrganizationUsage:
    # Serialize quota mutations per organization to avoid race-condition bypasses.
    await db.execute(
        select(Organization.id)
        .where(Organization.id == organization_id)
        .with_for_update()
    )
    return await _get_or_create_usage(db, organization_id)


async def _count_resource_records(
    db: AsyncSession,
    organization_id: UUID,
    resource: str
) -> int | None:
    if resource == "projects":
        query = select(func.count(Project.id)).where(Project.organization_id == organization_id)
    elif resource == "clients":
        query = select(func.count(Client.id)).where(Client.organization_id == organization_id)
    elif resource == "proposals":
        query = select(func.count(Proposal.id)).where(Proposal.organization_id == organization_id)
    elif resource == "users":
        query = select(func.count(Profile.id)).where(
            Profile.organization_id == organization_id,
            Profile.is_active.is_(True),
        )
    else:
        return None

    result = await db.execute(query)
    return int(result.scalar() or 0)


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


async def ensure_and_reserve_storage_capacity(
    db: AsyncSession,
    organization: Organization,
    *,
    bytes_to_add: int
) -> None:
    entitlement = await get_entitlement(db, organization)
    if not entitlement or entitlement.max_storage_bytes is None:
        return

    usage = await _lock_usage_row(db, organization.id)
    current = usage.storage_bytes_used or 0
    if current + bytes_to_add > entitlement.max_storage_bytes:
        raise _limit_error("storage")

    usage.storage_bytes_used = current + bytes_to_add
    db.add(usage)


async def increment_storage_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    bytes_added: int
) -> None:
    usage = await _lock_usage_row(db, organization_id)
    usage.storage_bytes_used = (usage.storage_bytes_used or 0) + bytes_added
    db.add(usage)


async def decrement_storage_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    bytes_removed: int
) -> None:
    usage = await _lock_usage_row(db, organization_id)
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


async def ensure_and_reserve_ai_credits(
    db: AsyncSession,
    organization: Organization,
    *,
    credits_to_add: int = 1
) -> None:
    entitlement = await get_entitlement(db, organization)
    if not entitlement or entitlement.ai_credits is None:
        return

    usage = await _lock_usage_row(db, organization.id)
    current = usage.ai_credits_used or 0
    if current + credits_to_add > entitlement.ai_credits:
        raise _limit_error("AI credits")

    usage.ai_credits_used = current + credits_to_add
    db.add(usage)


async def increment_ai_usage(
    db: AsyncSession,
    organization_id: UUID,
    *,
    credits_added: int = 1
) -> None:
    usage = await _lock_usage_row(db, organization_id)
    usage.ai_credits_used = (usage.ai_credits_used or 0) + credits_added
    db.add(usage)


async def increment_usage_count(
    db: AsyncSession,
    organization_id: UUID,
    *,
    resource: str,
    delta: int = 1
) -> None:
    usage = await _lock_usage_row(db, organization_id)
    field_map = {
        "projects": "projects_count",
        "clients": "clients_count",
        "proposals": "proposals_count",
        "users": "users_count",
    }
    field = field_map.get(resource)
    if not field:
        return
    current = getattr(usage, field) or 0
    setattr(usage, field, max(0, current + delta))
    db.add(usage)


async def ensure_and_reserve_resource_limit(
    db: AsyncSession,
    organization: Organization,
    *,
    resource: str,
    delta: int = 1
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
    field_map = {
        "projects": "projects_count",
        "clients": "clients_count",
        "proposals": "proposals_count",
        "users": "users_count",
    }

    limit = limit_map.get(resource)
    field = field_map.get(resource)
    if field is None:
        return

    usage = await _lock_usage_row(db, organization.id)
    actual_current = await _count_resource_records(db, organization.id, resource)
    current = actual_current if actual_current is not None else (getattr(usage, field) or 0)
    setattr(usage, field, current)
    if limit is not None and current + delta > limit:
        raise _limit_error(resource)

    setattr(usage, field, max(0, current + delta))
    db.add(usage)
