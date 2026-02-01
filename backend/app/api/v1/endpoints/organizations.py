from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_current_organization, get_current_profile, require_owner_or_admin, require_read_only, require_billing_active
from app.db.session import get_db
from app.modules.commercial.service import organization_service
from app.schemas.organizations import Organization, OrganizationCreate, OrganizationUpdate
from app.schemas.bank_accounts import BankAccountCreate
from app.models.organizations import Organization as OrganizationModel
from app.models.profiles import Profile
from app.services.billing import setup_trial_for_organization
from app.services.financial import bank_account_service
from app.services.entitlements import increment_usage_count

import re
import uuid

router = APIRouter()


class OrganizationOnboardingRequest(BaseModel):
    name: str
    slug: str | None = None


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or f"org-{uuid.uuid4().hex[:8]}"


async def _ensure_unique_slug(db: AsyncSession, slug: str) -> str:
    base = slug
    suffix = 1
    while True:
        query = select(OrganizationModel).where(OrganizationModel.slug == slug)
        result = await db.execute(query)
        if not result.scalar_one_or_none():
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


@router.get("/me", response_model=Organization, dependencies=[Depends(require_read_only)])
async def get_my_organization(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Get the current user's organization details.
    """
    if not profile.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with any organization"
        )

    organization = await organization_service.get(
        db=db,
        organization_id=profile.organization_id,
        id=profile.organization_id
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.get("/{organization_id}", response_model=Organization, dependencies=[Depends(require_read_only)])
async def get_organization(
    organization_id: UUID,
    organization_id_validated: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Get organization by ID (must belong to current user).
    """
    organization = await organization_service.get(
        db=db,
        organization_id=organization_id_validated,
        id=organization_id
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.put(
    "/{organization_id}",
    response_model=Organization,
    dependencies=[Depends(require_owner_or_admin), Depends(require_billing_active)]
)
async def update_organization(
    organization_id: UUID,
    organization_in: OrganizationUpdate,
    organization_id_validated: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Update organization (must belong to current user).
    """
    if "default_bank_account_id" in organization_in.model_fields_set:
        if organization_in.default_bank_account_id is not None:
            account = await bank_account_service.get(
                db=db,
                organization_id=organization_id_validated,
                id=organization_in.default_bank_account_id
            )
            if not account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Default bank account not found or does not belong to your organization"
                )

    organization = await organization_service.update(
        db=db,
        organization_id=organization_id_validated,
        id=organization_id,
        obj_in=organization_in
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.post("/onboarding", response_model=Organization)
async def create_organization_onboarding(
    payload: OrganizationOnboardingRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Create an organization for the current user and start a Pro trial.
    This is intended for the initial onboarding flow after signup.
    """
    if profile.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already belongs to an organization"
        )

    slug = payload.slug or _slugify(payload.name)
    slug = await _ensure_unique_slug(db, slug)

    organization = OrganizationModel(
        name=payload.name,
        slug=slug,
        owner_profile_id=profile.id,
        billing_contact_user_id=profile.id
    )
    db.add(organization)
    await db.flush()
    await db.refresh(organization)

    await setup_trial_for_organization(
        db=db,
        organization=organization,
        user_email=profile.email
    )

    # Create default bank account for the organization
    default_account = await bank_account_service.create(
        db=db,
        organization_id=organization.id,
        obj_in=BankAccountCreate(name="Conta Principal", currency="BRL")
    )
    organization.default_bank_account_id = default_account.id
    db.add(organization)
    await db.flush()

    profile.organization_id = organization.id
    profile.role_v2 = "owner"
    # Keep legacy role in sync for older checks/UI
    profile.role = "admin"
    profile.is_master_owner = True
    db.add(profile)
    await increment_usage_count(db, organization.id, resource="users", delta=1)

    await db.commit()
    await db.refresh(organization)
    return organization
