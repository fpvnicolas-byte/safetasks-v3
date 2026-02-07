from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_organization_from_profile,
    require_admin_or_manager,
    require_billing_active,
    require_master_owner,
    get_current_profile,
    get_effective_role,
)
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.access import ProjectAssignment
from app.schemas.invites import TeamMemberOut, ChangeRolePayload
from app.services.entitlements import increment_usage_count

router = APIRouter()

ROLE_V2_TO_LEGACY = {
    "admin": "admin",
    "producer": "manager",
    "finance": "viewer",
    "freelancer": "crew",
}

# Hierarchy for removal permissions (who can remove whom)
REMOVE_PERMISSION = {
    "owner": {"admin", "producer", "finance", "freelancer"},
    "admin": {"producer", "finance", "freelancer"},
    "producer": {"freelancer"},
}


@router.get(
    "/members",
    response_model=List[TeamMemberOut],
    dependencies=[Depends(require_admin_or_manager)],
)
async def list_members(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[TeamMemberOut]:
    """List all active members of the organization."""
    result = await db.execute(
        select(Profile).where(
            Profile.organization_id == organization_id,
            Profile.is_active == True,
        )
    )
    profiles = result.scalars().all()

    return [
        TeamMemberOut(
            id=p.id,
            email=p.email,
            full_name=p.full_name,
            avatar_url=p.avatar_url,
            effective_role=get_effective_role(p),
            is_master_owner=p.is_master_owner,
            created_at=p.created_at,
        )
        for p in profiles
    ]


@router.patch(
    "/members/{profile_id}/role",
    dependencies=[Depends(require_master_owner()), Depends(require_billing_active())],
)
async def change_member_role(
    profile_id: UUID,
    payload: ChangeRolePayload,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Change a member's role. Only the owner can do this."""
    new_role = payload.role_v2.strip().lower()

    if new_role not in {"admin", "producer", "finance", "freelancer"}:
        raise HTTPException(status_code=400, detail=f"Invalid role: {new_role}")

    if new_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign owner role.")

    if profile_id == profile.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role.")

    # Load target
    target = await db.get(Profile, profile_id)
    if not target or target.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Member not found in your organization.")

    if target.is_master_owner:
        raise HTTPException(status_code=403, detail="Cannot change the owner's role.")

    old_role = get_effective_role(target)

    target.role_v2 = new_role
    target.role = ROLE_V2_TO_LEGACY.get(new_role, "viewer")
    db.add(target)

    # If changing TO freelancer, they start with no project assignments (see zero projects)
    # If changing FROM freelancer, remove stale project assignments (they now see all)
    if old_role == "freelancer" and new_role != "freelancer":
        await db.execute(
            delete(ProjectAssignment).where(ProjectAssignment.user_id == profile_id)
        )

    await db.flush()

    return {
        "detail": "Role updated.",
        "profile_id": str(profile_id),
        "new_role": new_role,
    }


@router.delete(
    "/members/{profile_id}",
    dependencies=[Depends(require_admin_or_manager), Depends(require_billing_active())],
)
async def remove_member(
    profile_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the organization."""
    if profile_id == profile.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself.")

    target = await db.get(Profile, profile_id)
    if not target or target.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Member not found in your organization.")

    if target.is_master_owner:
        raise HTTPException(status_code=403, detail="Cannot remove the organization owner.")

    # Permission check
    remover_role = get_effective_role(profile)
    target_role = get_effective_role(target)
    allowed = REMOVE_PERMISSION.get(remover_role, set())
    if target_role not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"You do not have permission to remove a member with role '{target_role}'.",
        )

    # Soft disconnect
    target.organization_id = None
    target.role_v2 = None
    target.role = "viewer"
    db.add(target)

    # Clean up project assignments
    await db.execute(
        delete(ProjectAssignment).where(ProjectAssignment.user_id == profile_id)
    )

    # Decrement seat count
    await increment_usage_count(db, organization_id, resource="users", delta=-1)

    await db.flush()

    return {"detail": "Member removed."}
