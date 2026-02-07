from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_organization_from_profile,
    require_admin_or_manager,
    require_billing_active,
    get_current_profile,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.profiles import Profile
from app.schemas.invites import (
    InviteCreate,
    InviteOut,
    InviteAccept,
    InviteCreateResponse,
)
from app.services import invite_service

router = APIRouter()


@router.post(
    "/",
    response_model=InviteCreateResponse,
    dependencies=[Depends(require_admin_or_manager), Depends(require_billing_active())],
)
async def create_invite(
    payload: InviteCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> InviteCreateResponse:
    """Create and send an organization invite."""
    return await invite_service.create_invite(
        db=db,
        org_id=organization_id,
        creator_profile=profile,
        payload=payload,
        frontend_url=str(settings.FRONTEND_URL),
    )


@router.get(
    "/",
    response_model=List[InviteOut],
    dependencies=[Depends(require_admin_or_manager)],
)
async def list_invites(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[InviteOut]:
    """List all invites for the organization."""
    invites = await invite_service.list_invites(db=db, org_id=organization_id)
    return [InviteOut.model_validate(inv) for inv in invites]


@router.post(
    "/{invite_id}/resend",
    dependencies=[Depends(require_admin_or_manager), Depends(require_billing_active())],
)
async def resend_invite(
    invite_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Resend an invite (regenerates token and resets expiry)."""
    invite_link = await invite_service.resend_invite(
        db=db,
        org_id=organization_id,
        invite_id=invite_id,
        resender_profile=profile,
        frontend_url=str(settings.FRONTEND_URL),
    )
    return {"invite_link": invite_link}


@router.post(
    "/{invite_id}/revoke",
    dependencies=[Depends(require_admin_or_manager), Depends(require_billing_active())],
)
async def revoke_invite(
    invite_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a pending invite (soft revoke for audit trail)."""
    await invite_service.revoke_invite(
        db=db,
        org_id=organization_id,
        invite_id=invite_id,
        revoker_profile=profile,
    )
    return {"detail": "Invite revoked."}


@router.post("/accept")
async def accept_invite(
    payload: InviteAccept,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept an invite using the token.
    Uses get_current_profile (NOT get_organization_from_profile)
    because the accepting user has no org yet.
    """
    updated_profile = await invite_service.accept_invite(
        db=db,
        token=payload.token,
        accepting_profile=profile,
    )
    return {
        "detail": "Invite accepted.",
        "organization_id": str(updated_profile.organization_id),
        "role_v2": updated_profile.role_v2,
    }
