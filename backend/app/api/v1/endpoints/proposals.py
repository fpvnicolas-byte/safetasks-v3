from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_organization_from_profile, require_admin_or_manager, require_admin
from app.db.session import get_db
from app.modules.commercial.service import proposal_service
from app.schemas.proposals import (
    Proposal, ProposalCreate, ProposalUpdate,
    ProposalWithClient, ProposalApproval
)

router = APIRouter()


@router.get("/", response_model=List[Proposal])
async def get_proposals(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    client_id: UUID = None,
    status: str = Query(None, regex="^(draft|sent|approved|rejected|expired)$"),
) -> List[Proposal]:
    """
    Get all proposals for the current user's organization.
    """
    filters = {}
    if client_id:
        filters["client_id"] = client_id
    if status:
        filters["status"] = status

    proposals = await proposal_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return proposals


@router.post("/", response_model=Proposal)
async def create_proposal(
    proposal_in: ProposalCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Create a new proposal in the current user's organization.
    Validates client ownership.
    """
    try:
        proposal = await proposal_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=proposal_in
        )
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{proposal_id}", response_model=Proposal)
async def get_proposal(
    proposal_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Get proposal by ID (must belong to current user's organization).
    """
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

    return proposal


@router.put("/{proposal_id}", response_model=Proposal)
async def update_proposal(
    proposal_id: UUID,
    proposal_in: ProposalUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Update proposal (must belong to current user's organization).
    Validates client ownership if client_id is being changed.
    """
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


@router.delete("/{proposal_id}", response_model=Proposal)
async def delete_proposal(
    proposal_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Delete proposal (must belong to current user's organization).
    """
    proposal = await proposal_service.remove(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )

    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    return proposal


@router.post("/{proposal_id}/approve", response_model=Proposal)
async def approve_proposal(
    proposal_id: UUID,
    approval_data: ProposalApproval,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Approve proposal and automatically convert to project.
    Only proposals with 'sent' status can be approved.
    This creates a new project and links it to the proposal.
    """
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
