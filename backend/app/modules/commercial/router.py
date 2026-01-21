from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user, UserContext
from app.core.database import get_db
from app.core.schemas import SuccessResponse, ListResponse

from . import schemas, models, services

# Create router
router = APIRouter(prefix="/commercial", tags=["commercial"])

# Initialize services
client_svc = services.client_service
budget_svc = services.budget_service
proposal_svc = services.proposal_service


# Client endpoints
@router.get("/clients", response_model=ListResponse[schemas.ClientRead])
async def read_clients(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search query"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    tax_id: Optional[str] = Query(None, description="Filter by tax ID")
):
    """Get paginated list of clients."""
    # Create filter params
    filters = schemas.ClientFilter(
        search=search,
        is_active=is_active,
        tax_id=tax_id
    )

    # Calculate pagination
    skip = (page - 1) * page_size

    # Get clients
    clients = await client_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="name"
    )

    # Get total count
    total = await client_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=clients,
        pagination={
            "items": clients,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(clients)} clients"
    )


@router.get("/clients/{client_id}", response_model=SuccessResponse[schemas.ClientRead])
async def read_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get client by ID."""
    client = await client_svc.get(db=db, id=client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return SuccessResponse(data=client, message="Client retrieved successfully")


@router.post("/clients", response_model=SuccessResponse[schemas.ClientRead], status_code=201)
async def create_client(
    client_in: schemas.ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new client."""
    client = await client_svc.create(db=db, obj_in=client_in)
    return SuccessResponse(data=client, message="Client created successfully")


@router.put("/clients/{client_id}", response_model=SuccessResponse[schemas.ClientRead])
async def update_client(
    client_id: int,
    client_in: schemas.ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update client."""
    client = await client_svc.get(db=db, id=client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    updated_client = await client_svc.update(db=db, db_obj=client, obj_in=client_in)
    return SuccessResponse(data=updated_client, message="Client updated successfully")


@router.delete("/clients/{client_id}", response_model=SuccessResponse[dict])
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete client."""
    client = await client_svc.exists(db=db, id=client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    await client_svc.remove(db=db, id=client_id)
    return SuccessResponse(data={"id": client_id}, message="Client deleted successfully")


# Budget endpoints
@router.get("/budgets", response_model=ListResponse[schemas.BudgetRead])
async def read_budgets(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search query"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_active: bool = Query(True, description="Filter by active status")
):
    """Get paginated list of budgets."""
    filters = schemas.BudgetFilter(
        search=search,
        client_id=client_id,
        status=status,
        is_active=is_active
    )

    skip = (page - 1) * page_size

    budgets = await budget_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="created_at",
        order_desc=True
    )

    total = await budget_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=budgets,
        pagination={
            "items": budgets,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(budgets)} budgets"
    )


@router.get("/budgets/{budget_id}", response_model=SuccessResponse[schemas.BudgetRead])
async def read_budget(
    budget_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get budget by ID."""
    budget = await budget_svc.get(db=db, id=budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return SuccessResponse(data=budget, message="Budget retrieved successfully")


@router.post("/budgets", response_model=SuccessResponse[schemas.BudgetRead], status_code=201)
async def create_budget(
    budget_in: schemas.BudgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new budget."""
    # Create budget with calculated totals
    budget_data = budget_in.model_dump()
    budget = models.Budget(**budget_data)
    budget.created_by = current_user["user_id"]
    budget.calculate_totals()

    budget = await budget_svc.create(db=db, obj_in=budget)
    return SuccessResponse(data=budget, message="Budget created successfully")


@router.put("/budgets/{budget_id}", response_model=SuccessResponse[schemas.BudgetRead])
async def update_budget(
    budget_id: int,
    budget_in: schemas.BudgetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update budget."""
    budget = await budget_svc.get(db=db, id=budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    updated_budget = await budget_svc.update(db=db, db_obj=budget, obj_in=budget_in)
    # Recalculate totals after update
    updated_budget.calculate_totals()
    await db.commit()
    await db.refresh(updated_budget)

    return SuccessResponse(data=updated_budget, message="Budget updated successfully")


@router.post("/budgets/{budget_id}/versions", response_model=SuccessResponse[schemas.BudgetRead], status_code=201)
async def create_budget_version(
    budget_id: int,
    version_data: schemas.BudgetVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new version of an existing budget."""
    new_version = await budget_svc.create_budget_version(
        db=db,
        parent_budget_id=budget_id,
        version_data=version_data,
        created_by=current_user["user_id"]
    )
    return SuccessResponse(data=new_version, message="Budget version created successfully")


@router.post("/budgets/{budget_id}/approve", response_model=SuccessResponse[schemas.BudgetRead])
async def approve_budget(
    budget_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Approve a budget."""
    approved_budget = await budget_svc.approve_budget(
        db=db,
        budget_id=budget_id,
        approved_by=current_user["user_id"]
    )
    return SuccessResponse(data=approved_budget, message="Budget approved successfully")


@router.post("/budgets/calculate", response_model=SuccessResponse[schemas.BudgetCalculationResponse])
async def calculate_budget(
    calculation_request: schemas.BudgetCalculationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Calculate budget totals."""
    result = await budget_svc.calculate_budget(calculation_request)
    return SuccessResponse(data=result, message="Budget calculation completed")


# Proposal endpoints
@router.get("/proposals", response_model=ListResponse[schemas.ProposalRead])
async def read_proposals(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search query"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    budget_id: Optional[int] = Query(None, description="Filter by budget ID"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get paginated list of proposals."""
    filters = schemas.ProposalFilter(
        search=search,
        client_id=client_id,
        budget_id=budget_id,
        status=status
    )

    skip = (page - 1) * page_size

    proposals = await proposal_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="created_at",
        order_desc=True
    )

    total = await proposal_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=proposals,
        pagination={
            "items": proposals,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(proposals)} proposals"
    )


@router.get("/proposals/{proposal_id}", response_model=SuccessResponse[schemas.ProposalRead])
async def read_proposal(
    proposal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get proposal by ID."""
    proposal = await proposal_svc.get(db=db, id=proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    return SuccessResponse(data=proposal, message="Proposal retrieved successfully")


@router.post("/proposals", response_model=SuccessResponse[schemas.ProposalRead], status_code=201)
async def create_proposal(
    proposal_in: schemas.ProposalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new proposal."""
    proposal = await proposal_svc.create_proposal(
        db=db,
        proposal_data=proposal_in,
        created_by=current_user["user_id"]
    )
    return SuccessResponse(data=proposal, message="Proposal created successfully")


@router.put("/proposals/{proposal_id}", response_model=SuccessResponse[schemas.ProposalRead])
async def update_proposal(
    proposal_id: int,
    proposal_in: schemas.ProposalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update proposal."""
    proposal = await proposal_svc.get(db=db, id=proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    updated_proposal = await proposal_svc.update(db=db, db_obj=proposal, obj_in=proposal_in)
    return SuccessResponse(data=updated_proposal, message="Proposal updated successfully")


@router.post("/proposals/{proposal_id}/send", response_model=SuccessResponse[schemas.ProposalRead])
async def send_proposal(
    proposal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Send proposal to client."""
    sent_proposal = await proposal_svc.send_proposal(
        db=db,
        proposal_id=proposal_id,
        sent_by=current_user["user_id"]
    )
    return SuccessResponse(data=sent_proposal, message="Proposal sent successfully")


@router.post("/proposals/{proposal_id}/approve", response_model=SuccessResponse[schemas.ProposalRead])
async def approve_proposal(
    proposal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Approve proposal."""
    approved_proposal = await proposal_svc.approve_proposal(
        db=db,
        proposal_id=proposal_id,
        approved_by=current_user["user_id"]
    )
    return SuccessResponse(data=approved_proposal, message="Proposal approved successfully")


@router.post("/proposals/{proposal_id}/reject", response_model=SuccessResponse[schemas.ProposalRead])
async def reject_proposal(
    proposal_id: int,
    rejection_data: schemas.ProposalRejectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Reject proposal."""
    rejected_proposal = await proposal_svc.reject_proposal(
        db=db,
        proposal_id=proposal_id,
        rejected_by=current_user["user_id"],
        reason=rejection_data.reason
    )
    return SuccessResponse(data=rejected_proposal, message="Proposal rejected successfully")


@router.delete("/proposals/{proposal_id}", response_model=SuccessResponse[dict])
async def delete_proposal(
    proposal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete proposal."""
    proposal = await proposal_svc.exists(db=db, id=proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    await proposal_svc.remove(db=db, id=proposal_id)
    return SuccessResponse(data={"id": proposal_id}, message="Proposal deleted successfully")