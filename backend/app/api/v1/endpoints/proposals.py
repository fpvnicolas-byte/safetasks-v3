from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_profile,
    require_owner_admin_or_producer,
    require_admin_producer_or_finance,
    require_read_only,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
    get_organization_record,
)
from app.db.session import get_db
from app.modules.commercial.service import proposal_service
from app.schemas.proposals import (
    Proposal, ProposalCreate, ProposalUpdate,
    ProposalWithClient, ProposalApproval
)
from app.services.entitlements import ensure_resource_limit, increment_usage_count

router = APIRouter()


@router.get("/", response_model=List[Proposal], dependencies=[Depends(require_read_only)])
async def get_proposals(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    client_id: UUID = None,
    status: str = Query(None, regex="^(draft|sent|approved|rejected|expired)$"),
) -> List[Proposal]:
    """
    Get all proposals for the current user's organization.
    """
    organization_id = profile.organization_id
    filters = {}
    if client_id:
        filters["client_id"] = client_id
    if status:
        filters["status"] = status

    if get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        filters["project_id"] = assigned_project_ids

    proposals = await proposal_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return proposals


@router.post(
    "/",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_proposal(
    proposal_in: ProposalCreate,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Create a new proposal in the current user's organization.
    Validates client ownership.
    """
    organization_id = profile.organization_id
    try:
        organization = await get_organization_record(profile, db)
        proposal_count = await proposal_service.count(db=db, organization_id=organization_id)
        await ensure_resource_limit(db, organization, resource="proposals", current_count=proposal_count)

        proposal = await proposal_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=proposal_in
        )
        await increment_usage_count(db, organization_id, resource="proposals", delta=1)
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{proposal_id}", response_model=Proposal, dependencies=[Depends(require_read_only)])
async def get_proposal(
    proposal_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Get proposal by ID (must belong to current user's organization).
    """
    organization_id = profile.organization_id
    proposal = await proposal_service.get(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )

    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    if proposal.project_id:
        await enforce_project_assignment(proposal.project_id, db, profile)
    else:
        if get_effective_role(profile) == "freelancer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: proposal not assigned to a project"
            )

    return proposal


@router.put(
    "/{proposal_id}",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_proposal(
    proposal_id: UUID,
    proposal_in: ProposalUpdate,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Update proposal (must belong to current user's organization).
    Validates client ownership if client_id is being changed.
    """
    organization_id = profile.organization_id
    try:
        proposal = await proposal_service.update(
            db=db,
            organization_id=organization_id,
            id=proposal_id,
            obj_in=proposal_in
        )

        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proposal not found"
            )

        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{proposal_id}",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_proposal(
    proposal_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Delete proposal (must belong to current user's organization).
    """
    organization_id = profile.organization_id
    proposal = await proposal_service.remove(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )
    await increment_usage_count(db, organization_id, resource="proposals", delta=-1)

    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    return proposal


@router.post(
    "/{proposal_id}/approve",
    response_model=Proposal,
    dependencies=[Depends(require_admin_producer_or_finance), Depends(require_billing_active)]
)
async def approve_proposal(
    proposal_id: UUID,
    approval_data: ProposalApproval,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Approve proposal and automatically convert to project.
    Only proposals with 'sent' status can be approved.
    This creates a new project and links it to the proposal.
    """
    organization_id = profile.organization_id
    try:
        proposal = await proposal_service.approve_proposal(
            db=db,
            organization_id=organization_id,
            proposal_id=proposal_id,
            approval_data=approval_data
        )
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
