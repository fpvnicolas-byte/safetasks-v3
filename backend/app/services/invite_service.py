import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.invites import OrganizationInvite
from app.models.profiles import Profile
from app.models.commercial import Supplier
from app.models.billing import OrganizationUsage
from app.models.organizations import Organization
from app.schemas.invites import InviteCreate, InviteOut, InviteCreateResponse
from app.services.entitlements import ensure_and_reserve_resource_limit
from app.api.deps import get_effective_role


# Role_v2 → legacy role mapping
ROLE_V2_TO_LEGACY = {
    "admin": "admin",
    "producer": "manager",
    "finance": "viewer",
    "freelancer": "crew",
}

VALID_INVITE_ROLES = {"admin", "producer", "finance", "freelancer"}

# Which roles can each role invite?
INVITE_PERMISSION = {
    "owner": {"admin", "producer", "finance", "freelancer"},
    "admin": {"producer", "finance", "freelancer"},
    "producer": {"freelancer"},
}


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _can_invite(inviter_role: str, target_role: str) -> bool:
    allowed = INVITE_PERMISSION.get(inviter_role, set())
    return target_role in allowed


def _can_remove(remover_role: str, target_role: str) -> bool:
    """Same permission matrix as invite — if you can invite that role, you can remove it."""
    return _can_invite(remover_role, target_role)


async def create_invite(
    db: AsyncSession,
    org_id: UUID,
    creator_profile: Profile,
    payload: InviteCreate,
    frontend_url: str,
) -> InviteCreateResponse:
    email = payload.email.strip().lower()
    role = payload.role_v2.strip().lower()

    if role not in VALID_INVITE_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}. Must be one of: {', '.join(VALID_INVITE_ROLES)}")

    creator_role = get_effective_role(creator_profile)
    if not _can_invite(creator_role, role):
        raise HTTPException(status_code=403, detail="You do not have permission to invite this role.")

    if email == creator_profile.email.strip().lower():
        raise HTTPException(status_code=400, detail="You cannot invite yourself.")

    # Check if already a member
    existing_member = await db.execute(
        select(Profile).where(
            and_(
                Profile.organization_id == org_id,
                Profile.email == email,
                Profile.is_active == True,
            )
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This email is already a member of your organization.")

    # Check for existing pending invite (partial unique index will also catch this)
    existing_invite = await db.execute(
        select(OrganizationInvite).where(
            and_(
                OrganizationInvite.org_id == org_id,
                OrganizationInvite.invited_email == email,
                OrganizationInvite.status == "pending",
            )
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An invite is already pending for this email.")

    # Validate supplier linkage for freelancer invites
    if role == "freelancer" and payload.supplier_id:
        supplier = await db.get(Supplier, payload.supplier_id)
        if not supplier or supplier.organization_id != org_id:
            raise HTTPException(status_code=400, detail="Supplier not found in your organization.")
        if supplier.category != "freelancer":
            raise HTTPException(status_code=400, detail="Supplier must have category 'freelancer'.")
        if supplier.profile_id is not None:
            raise HTTPException(status_code=409, detail="This supplier is already linked to a profile.")

    # Seat warning (proactive, non-blocking)
    seat_warning = None
    usage_row = await db.execute(
        select(OrganizationUsage).where(OrganizationUsage.org_id == org_id)
    )
    usage = usage_row.scalar_one_or_none()
    if usage:
        org = await db.get(Organization, org_id)
        if org:
            from app.services.entitlements import get_entitlement
            entitlement = await get_entitlement(db, org)
            if entitlement and entitlement.max_users is not None:
                if usage.users_count >= entitlement.max_users:
                    seat_warning = "Your organization is at its seat limit. The invite will fail on accept unless you upgrade."

    # Generate token
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.INVITE_TOKEN_EXPIRY_DAYS)

    invite = OrganizationInvite(
        org_id=org_id,
        invited_email=email,
        role_v2=role,
        invited_by_id=creator_profile.id,
        supplier_id=payload.supplier_id if role == "freelancer" else None,
        status="pending",
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    invite_link = f"{frontend_url}/auth/accept-invite?token={raw_token}"

    return InviteCreateResponse(
        invite=InviteOut.model_validate(invite),
        invite_link=invite_link,
        seat_warning=seat_warning,
    )


async def accept_invite(
    db: AsyncSession,
    token: str,
    accepting_profile: Profile,
) -> Profile:
    token_hash = _hash_token(token)

    result = await db.execute(
        select(OrganizationInvite).where(
            and_(
                OrganizationInvite.token_hash == token_hash,
                OrganizationInvite.status == "pending",
            )
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used.")

    # Check expiry
    now = datetime.now(timezone.utc)
    if invite.expires_at < now:
        invite.status = "expired"
        db.add(invite)
        await db.flush()
        raise HTTPException(status_code=410, detail="This invite has expired. Ask the team admin to resend.")

    # Email match
    if accepting_profile.email.strip().lower() != invite.invited_email:
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address.")

    # Already in an org?
    if accepting_profile.organization_id is not None:
        raise HTTPException(status_code=409, detail="You already belong to an organization.")

    org = await db.get(Organization, invite.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    await ensure_and_reserve_resource_limit(db, org, resource="users")

    # Set profile fields
    accepting_profile.organization_id = invite.org_id
    accepting_profile.role_v2 = invite.role_v2
    accepting_profile.role = ROLE_V2_TO_LEGACY.get(invite.role_v2, "viewer")
    db.add(accepting_profile)

    # Link supplier if freelancer
    if invite.role_v2 == "freelancer" and invite.supplier_id:
        supplier = await db.get(Supplier, invite.supplier_id)
        if supplier and supplier.organization_id == invite.org_id:
            supplier.profile_id = accepting_profile.id
            db.add(supplier)

    # Update invite
    invite.status = "accepted"
    invite.accepted_by_id = accepting_profile.id
    invite.accepted_at = now
    db.add(invite)

    await db.flush()
    await db.refresh(accepting_profile)
    return accepting_profile


async def list_invites(
    db: AsyncSession,
    org_id: UUID,
) -> list[OrganizationInvite]:
    result = await db.execute(
        select(OrganizationInvite)
        .where(OrganizationInvite.org_id == org_id)
        .order_by(OrganizationInvite.created_at.desc())
    )
    return result.scalars().all()


async def revoke_invite(
    db: AsyncSession,
    org_id: UUID,
    invite_id: UUID,
    revoker_profile: Profile,
) -> None:
    result = await db.execute(
        select(OrganizationInvite).where(
            and_(
                OrganizationInvite.id == invite_id,
                OrganizationInvite.org_id == org_id,
            )
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is not pending.")

    revoker_role = get_effective_role(revoker_profile)
    if not _can_invite(revoker_role, invite.role_v2):
        raise HTTPException(status_code=403, detail="You do not have permission to revoke this invite.")

    invite.status = "revoked"
    db.add(invite)
    await db.flush()


async def resend_invite(
    db: AsyncSession,
    org_id: UUID,
    invite_id: UUID,
    resender_profile: Profile,
    frontend_url: str,
) -> str:
    result = await db.execute(
        select(OrganizationInvite).where(
            and_(
                OrganizationInvite.id == invite_id,
                OrganizationInvite.org_id == org_id,
            )
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is not pending.")

    resender_role = get_effective_role(resender_profile)
    if not _can_invite(resender_role, invite.role_v2):
        raise HTTPException(status_code=403, detail="You do not have permission to resend this invite.")

    # Generate new token and reset expiry
    raw_token = secrets.token_urlsafe(32)
    invite.token_hash = _hash_token(raw_token)
    invite.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.INVITE_TOKEN_EXPIRY_DAYS)
    db.add(invite)
    await db.flush()

    return f"{frontend_url}/auth/accept-invite?token={raw_token}"
