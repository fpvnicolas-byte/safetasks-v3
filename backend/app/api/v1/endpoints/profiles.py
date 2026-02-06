import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_effective_role, require_billing_read
from app.db.session import get_db
from app.models.profiles import Profile

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me")
async def get_my_profile(
    profile: Profile = Depends(get_current_profile),
):
    """
    Get current user's profile.

    This endpoint is called by the frontend AuthContext after login
    to retrieve the user's profile data including organization_id and role.

    NOTE: No billing gate here — this is the auth bootstrap endpoint.
    Users must always be able to fetch their own profile regardless of
    billing state, otherwise they cannot log in or reach the billing page.

    Returns:
        Profile data with organization_id for API authorization
    """
    try:
        return {
            "id": str(profile.id),
            "email": profile.email,
            "organization_id": str(profile.organization_id) if profile.organization_id else None,
            "role": profile.role,
            "role_v2": getattr(profile, "role_v2", None),
            "effective_role": get_effective_role(profile),
            "full_name": profile.full_name,
            "avatar_url": profile.avatar_url,
            "is_active": getattr(profile, "is_active", True),
            "is_master_owner": getattr(profile, "is_master_owner", False),
        }
    except Exception as e:
        logger.exception("Failed to serialize profile %s: %s", profile.id, e)
        raise HTTPException(status_code=500, detail=f"Profile serialization error: {str(e)}")
