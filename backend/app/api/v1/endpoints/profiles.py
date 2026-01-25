from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile
from app.db.session import get_db
from app.models.profiles import Profile

router = APIRouter()


@router.get("/me")
async def get_my_profile(
    profile: Profile = Depends(get_current_profile),
):
    """
    Get current user's profile.

    This endpoint is called by the frontend AuthContext after login
    to retrieve the user's profile data including organization_id and role.

    Returns:
        Profile data with organization_id for API authorization
    """
    return {
        "id": str(profile.id),
        "email": profile.email,
        "organization_id": str(profile.organization_id) if profile.organization_id else None,
        "role": profile.role,
        "full_name": profile.full_name,
        "avatar_url": profile.avatar_url,
        "is_active": profile.is_active,
    }
