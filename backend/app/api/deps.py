from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError

import logging
from app.core.config import settings
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.access import ProjectAssignment
from app.models.organizations import Organization

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> UUID:
    """
    Extract and validate JWT token from Authorization header.
    Returns the user ID from Supabase Auth.
    """
    if not credentials:
        logger.error(f"Missing credentials. URL: {request.url}")
        # Log sanitized headers (avoid logging sensitive cookies/keys if possible, or just log all for dev)
        headers = dict(request.headers)
        if "authorization" in headers:
            logger.warning(f"Authorization header present but not parsed correctly: {headers['authorization'][:10]}...")
        else:
            logger.warning("No Authorization header found.")
            # logger.debug(f"All Headers: {headers}")
            
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - Missing Authorization Header"
        )

    try:
        token = credentials.credentials
        # Decode JWT without verification for user info (Supabase handles verification)
        # In production, you might want to verify the token signature
        payload = jwt.get_unverified_claims(token)
        
        # logger.info(f"Token payload sub: {payload.get('sub')}")


        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID. Please use an authenticated user token, not an anon token."
            )

        return UUID(payload["sub"])

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


async def get_current_profile(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Profile:
    """
    Get the current user's profile.
    """
    query = select(Profile).where(Profile.id == user_id)
    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        logger.error(f"Profile not found for user_id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # logger.info(f"Profile found: {profile.id}, Org: {profile.organization_id}")

    return profile


async def get_current_organization(
    organization_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """
    Validate that the current user has access to the requested organization.
    Returns the organization_id if access is granted.
    """
    # Check if the user belongs to the requested organization
    query = select(Profile).where(
        Profile.id == user_id,
        Profile.organization_id == organization_id
    )

    result = await db.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        logger.warning(f"Access denied: User {user_id} does not belong to organization {organization_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: user does not belong to this organization"
        )

    return organization_id


async def get_organization_from_profile(
    profile: Profile = Depends(get_current_profile)
) -> UUID:
    """
    Get the organization ID from the current user's profile.
    This is a simpler alternative to get_current_organization when you don't
    need to validate against a specific organization_id parameter.
    """
    if not profile.organization_id:
        logger.warning(f"User {profile.id} does not belong to any organization")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any organization"
        )

    return profile.organization_id


def check_permissions(required_roles: list[str]):
    """
    Dependency factory for role-based permissions.
    Usage: Depends(check_permissions(["admin", "manager"]))
    """
    async def permission_checker(
        profile: Profile = Depends(get_current_profile)
    ) -> Profile:
        """
        Check if the current user has one of the required roles.
        """
        if profile.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for this operation. Required roles: {', '.join(required_roles)}. Your role: {profile.role}"
            )

        return profile

    return permission_checker


def get_effective_role(profile: Profile) -> str:
    """
    Return role_v2 if set, otherwise map legacy role to v2.
    This is non-breaking and only used by new authorization logic.
    """
    if profile.is_master_owner:
        return "owner"
    if profile.role_v2:
        return profile.role_v2

    legacy_map = {
        "admin": "admin",
        "manager": "producer",
        "crew": "freelancer",
        "viewer": "freelancer",
    }
    return legacy_map.get(profile.role, "finance")


async def get_assigned_project_ids(
    db: AsyncSession,
    profile: Profile
) -> list[UUID]:
    """
    Return project IDs assigned to the profile (freelancers only).
    """
    query = select(ProjectAssignment.project_id).where(ProjectAssignment.user_id == profile.id)
    result = await db.execute(query)
    return [row[0] for row in result.all()]


async def enforce_project_assignment(
    project_id: UUID,
    db: AsyncSession,
    profile: Profile
) -> None:
    """
    Ensure freelancers can only access assigned projects.
    """
    if get_effective_role(profile) != "freelancer":
        return

    assigned = await get_assigned_project_ids(db, profile)
    if project_id not in assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: project is not assigned to this user"
        )


def check_permissions_v2(required_roles: list[str]):
    """
    Dependency factory for v2 role-based permissions.
    Uses role_v2 when available and falls back to legacy mapping.
    Owner is treated as superuser.
    """
    async def permission_checker(
        profile: Profile = Depends(get_current_profile),
        db: AsyncSession = Depends(get_db)
    ) -> Profile:
        effective_role = get_effective_role(profile)

        if effective_role == "owner":
            # Even owners are blocked if org is canceled/blocked
            organization = await get_organization_record(profile, db)
            status_value = _normalize_billing_status(organization)
            if status_value in {"canceled", "blocked"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Billing is not active. Access denied."
                )
            return profile

        if effective_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for this operation. Required roles: {', '.join(required_roles)}. Your role: {effective_role}"
            )

        organization = await get_organization_record(profile, db)
        status_value = _normalize_billing_status(organization)
        if status_value in {"canceled", "blocked"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Billing is not active. Access denied."
            )

        return profile

    return permission_checker


async def get_organization_record(
    profile: Profile,
    db: AsyncSession
) -> Organization:
    query = select(Organization).where(Organization.id == profile.organization_id)
    result = await db.execute(query)
    organization = result.scalar_one_or_none()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    return organization


def _normalize_billing_status(organization: Organization) -> str:
    if organization.billing_status:
        return organization.billing_status

    # Backward compatibility mapping
    legacy_map = {
        "trialing": "trial_active",
        "active": "active",
        "past_due": "past_due",
        "cancelled": "canceled",
        "paused": "past_due",
    }
    return legacy_map.get(organization.subscription_status or "", "active")


def require_billing_active():
    """
    Block mutations for non-active billing states.
    trial_ended/past_due/billing_pending_review => read-only (402)
    canceled/blocked => deny (403)
    """
    async def billing_checker(
        profile: Profile = Depends(get_current_profile),
        db: AsyncSession = Depends(get_db)
    ) -> Profile:
        organization = await get_organization_record(profile, db)
        status_value = _normalize_billing_status(organization)

        if status_value in {"canceled", "blocked"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Billing is not active. Access denied."
            )

        if status_value in {"trial_ended", "past_due", "billing_pending_review"}:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Billing is not active. Please update payment to continue."
            )

        return profile

    return billing_checker


def require_billing_read():
    """
    Block all access for canceled/blocked organizations.
    """
    async def billing_checker(
        profile: Profile = Depends(get_current_profile),
        db: AsyncSession = Depends(get_db)
    ) -> Profile:
        organization = await get_organization_record(profile, db)
        status_value = _normalize_billing_status(organization)

        if status_value in {"canceled", "blocked"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Billing is not active. Access denied."
            )

        return profile

    return billing_checker


def require_master_owner():
    """
    Dependency that allows only the master owner.
    """
    async def permission_checker(
        profile: Profile = Depends(get_current_profile)
    ) -> Profile:
        if not profile.is_master_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the master owner can perform this operation."
            )
        return profile

    return permission_checker


# Convenience dependencies for common permission checks
require_admin = check_permissions_v2(["admin"])
require_admin_or_manager = check_permissions_v2(["admin", "producer"])
require_admin_manager_or_crew = check_permissions_v2(["admin", "producer", "freelancer"])
require_read_only = check_permissions_v2(["admin", "producer", "finance", "freelancer"])

# V2-specific convenience dependencies
require_owner_or_admin = check_permissions_v2(["admin"])
require_owner_admin_or_producer = check_permissions_v2(["admin", "producer"])
require_owner_admin_producer_or_freelancer = check_permissions_v2(["admin", "producer", "freelancer"])
require_read_only_v2 = check_permissions_v2(["admin", "producer", "finance", "freelancer"])
require_finance_or_admin = check_permissions_v2(["admin", "finance"])
require_admin_producer_or_finance = check_permissions_v2(["admin", "producer", "finance"])
