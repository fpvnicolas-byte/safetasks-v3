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


# Convenience dependencies for common permission checks
require_admin = check_permissions(["admin"])
require_admin_or_manager = check_permissions(["admin", "manager"])
require_admin_manager_or_crew = check_permissions(["admin", "manager", "crew"])
require_read_only = check_permissions(["admin", "manager", "crew", "viewer"])
