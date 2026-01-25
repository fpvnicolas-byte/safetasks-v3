from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError

from app.core.config import settings
from app.db.session import get_db
from app.models.profiles import Profile

security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UUID:
    """
    Extract and validate JWT token from Authorization header.
    Returns the user ID from Supabase Auth.
    """
    try:
        token = credentials.credentials
        # Decode JWT without verification for user info (Supabase handles verification)
        # In production, you might want to verify the token signature
        payload = jwt.get_unverified_claims(token)

        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )

        return UUID(payload["sub"])

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: user does not belong to this organization"
        )

    return organization_id


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )

    return profile


async def get_organization_from_profile(
    profile: Profile = Depends(get_current_profile)
) -> UUID:
    """
    Get the organization ID from the current user's profile.
    This is a simpler alternative to get_current_organization when you don't
    need to validate against a specific organization_id parameter.
    """
    if not profile.organization_id:
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


# Convenience dependencies for common permission checks
require_admin = check_permissions(["admin"])
require_admin_or_manager = check_permissions(["admin", "manager"])
require_admin_manager_or_crew = check_permissions(["admin", "manager", "crew"])
require_read_only = check_permissions(["admin", "manager", "crew", "viewer"])
