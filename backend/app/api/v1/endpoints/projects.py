from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_organization,
    require_read_only,
    require_owner_admin_or_producer,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
    get_organization_record,
)
from app.db.session import get_db
from app.models.access import ProjectAssignment as ProjectAssignmentModel
from app.models.ai import AiRecommendation, AiSuggestion, AiUsageLog, ScriptAnalysis
from app.models.clients import Client as ClientModel
from app.models.cloud import CloudSyncStatus as CloudSyncStatusModel, ProjectDriveFolder as ProjectDriveFolderModel
from app.models.commercial import Stakeholder as StakeholderModel
from app.models.financial import Invoice as InvoiceModel, InvoiceItem as InvoiceItemModel
from app.models.production import Character as CharacterModel, Scene as SceneModel, SceneCharacter as SceneCharacterModel
from app.models.proposals import Proposal as ProposalModel
from app.models.projects import Project as ProjectModel
from app.models.projects import project_services
from app.models.scheduling import ShootingDay as ShootingDayModel
from app.models.transactions import Transaction as TransactionModel
from app.modules.commercial.service import project_service, client_service
from app.services.entitlements import ensure_resource_limit, increment_usage_count
from app.schemas.projects import Project, ProjectCreate, ProjectUpdate, ProjectWithClient, ProjectStats

router = APIRouter()


@router.get("/", response_model=List[ProjectWithClient], dependencies=[Depends(require_read_only)])
async def get_projects(
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[ProjectWithClient]:
    """
    Get all projects for the current user's organization with client data.
    """
    if get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        projects = await project_service.get_multi(
            db=db,
            organization_id=organization_id,
            skip=skip,
            limit=limit,
            options=[selectinload(ProjectModel.client)],
            filters={"id": assigned_project_ids}
        )
    else:
        projects = await project_service.get_multi(
            db=db,
            organization_id=organization_id,
            skip=skip,
            limit=limit,
            options=[selectinload(ProjectModel.client)]
        )
    return projects


@router.post(
    "/",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_project(
    project_in: ProjectCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Create a new project in the current user's organization.
    Validates that the client belongs to the same organization.
    """
    organization = await get_organization_record(profile, db)
    project_count = await project_service.count(db=db, organization_id=organization_id)
    await ensure_resource_limit(db, organization, resource="projects", current_count=project_count)

    # Validate that the client belongs to the same organization
    client = await client_service.get(
        db=db,
        organization_id=organization_id,
        id=project_in.client_id
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client not found or does not belong to your organization"
        )

    project = await project_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=project_in
    )
    await increment_usage_count(db, organization_id, resource="projects", delta=1)

    # Load client relationship for response
    return await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project.id,
        options=[selectinload(ProjectModel.client)]
    )


@router.get("/pending-budgets", response_model=List[ProjectWithClient], dependencies=[Depends(require_read_only)])
async def get_pending_budget_projects(
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectWithClient]:
    """
    Get all projects with pending budget approvals.
    Only accessible to admins/owners who can approve budgets.
    """
    # Check admin permission
    if get_effective_role(profile) not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view pending budget approvals"
        )

    # Query projects with pending_approval or increment_pending status
    result = await db.execute(
        select(ProjectModel)
        .where(ProjectModel.organization_id == organization_id)
        .where(ProjectModel.budget_status.in_(["pending_approval", "increment_pending"]))
        .options(
            selectinload(ProjectModel.client),
            selectinload(ProjectModel.services)
        )
        .order_by(ProjectModel.updated_at.desc())
    )
    return result.scalars().all()



@router.get("/{project_id}", response_model=ProjectWithClient, dependencies=[Depends(require_read_only)])
async def get_project(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Get project by ID with client data (must belong to current user's organization).
    """

    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    await enforce_project_assignment(project_id, db, profile)

    return project


@router.put(
    "/{project_id}",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Update project (must belong to current user's organization).
    Validates client belongs to same organization if client_id is being updated.
    """
    # If client_id is being updated, validate it belongs to the same organization
    if project_in.client_id is not None:
        client = await client_service.get(
            db=db,
            organization_id=organization_id,
            id=project_in.client_id
        )

        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client not found or does not belong to your organization"
            )

    project = await project_service.update(
        db=db,
        organization_id=organization_id,
        id=project_id,
        obj_in=project_in
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Load client relationship for response
    return await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project.id,
        options=[selectinload(ProjectModel.client)]
    )


@router.delete(
    "/{project_id}",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_project(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Delete project (must belong to current user's organization).
    """
    # Get project with client data before deletion
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    try:
        # Detach financial and optional references (keep records for audit trails)
        await db.execute(
            update(TransactionModel)
            .where(TransactionModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(InvoiceModel)
            .where(InvoiceModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(InvoiceItemModel)
            .where(InvoiceItemModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(ProposalModel)
            .where(ProposalModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(CloudSyncStatusModel)
            .where(CloudSyncStatusModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(AiUsageLog)
            .where(AiUsageLog.project_id == project_id)
            .values(project_id=None)
        )

        # Remove assignment + association rows
        await db.execute(
            delete(ProjectAssignmentModel).where(ProjectAssignmentModel.project_id == project_id)
        )
        await db.execute(
            delete(project_services).where(project_services.c.project_id == project_id)
        )

        # Remove scene-character links before deleting scenes/characters
        scene_ids_subq = select(SceneModel.id).where(SceneModel.project_id == project_id)
        character_ids_subq = select(CharacterModel.id).where(CharacterModel.project_id == project_id)
        await db.execute(
            delete(SceneCharacterModel).where(SceneCharacterModel.scene_id.in_(scene_ids_subq))
        )
        await db.execute(
            delete(SceneCharacterModel).where(SceneCharacterModel.character_id.in_(character_ids_subq))
        )

        # Detach stakeholder-linked transactions before removing stakeholders
        stakeholder_ids_subq = select(StakeholderModel.id).where(StakeholderModel.project_id == project_id)
        await db.execute(
            update(TransactionModel)
            .where(TransactionModel.stakeholder_id.in_(stakeholder_ids_subq))
            .values(stakeholder_id=None)
        )

        # Delete production records tied to the project
        await db.execute(delete(SceneModel).where(SceneModel.project_id == project_id))
        await db.execute(delete(CharacterModel).where(CharacterModel.project_id == project_id))
        await db.execute(delete(ShootingDayModel).where(ShootingDayModel.project_id == project_id))
        await db.execute(delete(StakeholderModel).where(StakeholderModel.project_id == project_id))
        await db.execute(delete(ProjectDriveFolderModel).where(ProjectDriveFolderModel.project_id == project_id))

        # Delete AI artifacts for the project
        await db.execute(delete(ScriptAnalysis).where(ScriptAnalysis.project_id == project_id))
        await db.execute(delete(AiSuggestion).where(AiSuggestion.project_id == project_id))
        await db.execute(delete(AiRecommendation).where(AiRecommendation.project_id == project_id))

        # Delete the project itself
        await project_service.remove(
            db=db,
            organization_id=organization_id,
            id=project_id
        )
        await db.flush()
        await increment_usage_count(db, organization_id, resource="projects", delta=-1)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Project has related records that must be removed before deletion. "
                "Delete linked items (e.g., call sheets, stakeholders, AI artifacts), "
                "or archive the project instead."
            ),
        ) from exc

    return project


@router.get(
    "/{project_id}/stats",
    response_model=ProjectStats,
    dependencies=[Depends(require_read_only)]
)
async def get_project_stats(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectStats:
    """
    Get statistics for a project (scenes, characters, shooting days, etc.).
    """
    from sqlalchemy import func
    from app.schemas.projects import ProjectStats
    
    # Check if project exists and belongs to organization
    validation = await db.execute(
        select(ProjectModel.id)
        .where(ProjectModel.id == project_id)
        .where(ProjectModel.organization_id == organization_id)
    )
    if not validation.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # 1. Scenes Count
    scenes_result = await db.execute(
        select(func.count(SceneModel.id))
        .where(SceneModel.project_id == project_id)
    )
    scenes_count = scenes_result.scalar() or 0

    # 2. Characters Count
    chars_result = await db.execute(
        select(func.count(CharacterModel.id))
        .where(CharacterModel.project_id == project_id)
    )
    chars_count = chars_result.scalar() or 0

    # 3. Shooting Days (Total)
    days_result = await db.execute(
        select(func.count(ShootingDayModel.id))
        .where(ShootingDayModel.project_id == project_id)
    )
    days_count = days_result.scalar() or 0

    # 4. Confirmed Shooting Days
    confirmed_days_result = await db.execute(
        select(func.count(ShootingDayModel.id))
        .where(ShootingDayModel.project_id == project_id)
        .where(ShootingDayModel.status == 'confirmed')
    )
    confirmed_days_count = confirmed_days_result.scalar() or 0

    # 5. Team Count (Stakeholders)
    team_result = await db.execute(
        select(func.count(StakeholderModel.id))
        .where(StakeholderModel.project_id == project_id)
    )
    team_count = team_result.scalar() or 0

    return ProjectStats(
        scenes_count=scenes_count,
        characters_count=chars_count,
        shooting_days_count=days_count,
        confirmed_shooting_days_count=confirmed_days_count,
        team_count=team_count
    )

# =============================================================================
# Budget Approval Endpoints
# =============================================================================


from pydantic import BaseModel
from datetime import datetime as dt


class BudgetSubmitRequest(BaseModel):
    """Request to submit budget for approval."""
    budget_total_cents: int
    notes: str | None = None


class BudgetApprovalRequest(BaseModel):
    """Request to approve or reject budget."""
    notes: str | None = None


class BudgetRejectionRequest(BaseModel):
    """Request to reject budget."""
    reason: str


class BudgetIncrementRequest(BaseModel):
    """Request to increase approved budget."""
    increment_cents: int
    notes: str | None = None


@router.post(
    "/{project_id}/budget/submit",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def submit_budget_for_approval(
    project_id: UUID,
    request: BudgetSubmitRequest,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Submit project budget for admin approval.
    Sets budget_status to 'pending_approval'.
    """
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.budget_status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Budget cannot be submitted from '{project.budget_status}' status"
        )

    # Update budget and status
    project.budget_total_cents = request.budget_total_cents
    project.budget_status = "pending_approval"
    project.budget_notes = request.notes
    project.budget_approved_by = None
    project.budget_approved_at = None

    await db.commit()
    await db.refresh(project)

    return project


@router.post(
    "/{project_id}/budget/approve",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def approve_budget(
    project_id: UUID,
    request: BudgetApprovalRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Approve project budget. Only admins can approve.
    Sets budget_status to 'approved'.
    """
    # Check admin permission
    if get_effective_role(profile) not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can approve budgets"
        )

    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.budget_status not in ("pending_approval", "increment_pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Budget is not pending approval (current: '{project.budget_status}')"
        )

    # Handle increment approval vs initial budget approval
    if project.budget_status == "increment_pending":
        # Add increment to current budget
        project.budget_total_cents += project.budget_increment_requested_cents
        if request.notes:
            project.budget_notes = f"Increment approved: {request.notes}"
        else:
            project.budget_notes = f"Budget increment of {project.budget_increment_requested_cents} cents approved"
        # Clear increment request fields
        project.budget_increment_requested_cents = 0
        project.budget_increment_notes = None
        project.budget_increment_requested_at = None
        project.budget_increment_requested_by = None
    else:
        # Initial budget approval
        if request.notes:
            project.budget_notes = request.notes
    
    # Set approved status
    project.budget_status = "approved"
    project.budget_approved_by = profile.id
    project.budget_approved_at = dt.utcnow()

    await db.commit()
    await db.refresh(project)

    return project


@router.post(
    "/{project_id}/budget/reject",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def reject_budget(
    project_id: UUID,
    request: BudgetRejectionRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Reject project budget. Only admins can reject.
    Sets budget_status to 'rejected' with reason.
    """
    # Check admin permission
    if get_effective_role(profile) not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reject budgets"
        )

    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.budget_status not in ("pending_approval", "increment_pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Budget is not pending approval (current: '{project.budget_status}')"
        )

    # Handle increment rejection vs initial budget rejection
    if project.budget_status == "increment_pending":
        # Reject increment - keep original budget, return to approved
        project.budget_status = "approved"
        project.budget_notes = f"Increment rejected: {request.reason}"
        # Clear increment request fields
        project.budget_increment_requested_cents = 0
        project.budget_increment_notes = None
        project.budget_increment_requested_at = None
        project.budget_increment_requested_by = None
    else:
        # Initial budget rejection
        project.budget_status = "rejected"
        project.budget_notes = f"Rejected: {request.reason}"

    await db.commit()
    await db.refresh(project)

    return project


@router.post(
    "/{project_id}/budget/request-increment",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def request_budget_increment(
    project_id: UUID,
    request: BudgetIncrementRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Request a budget increase for an approved project.
    Sets budget_status to 'increment_pending' for admin approval.
    """
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project.budget_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Budget increment can only be requested for approved budgets (current: '{project.budget_status}')"
        )

    if request.increment_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Increment amount must be positive"
        )

    # Set increment request fields
    project.budget_status = "increment_pending"
    project.budget_increment_requested_cents = request.increment_cents
    project.budget_increment_notes = request.notes
    project.budget_increment_requested_at = dt.utcnow()
    project.budget_increment_requested_by = profile.id

    await db.commit()
    await db.refresh(project)

    return project


# =============================================================================
# Financial Summary Endpoint
# =============================================================================

class ProjectFinancialSummary(BaseModel):
    """Complete financial summary for a project."""
    project_id: UUID
    # Proposal / Revenue
    proposal_value_cents: int
    proposal_status: str | None
    # Budget
    budget_total_cents: int
    budget_status: str
    budget_approved_at: dt | None
    # Actuals
    total_income_cents: int
    total_expense_cents: int
    # Calculated
    remaining_budget_cents: int
    profit_cents: int
    profit_margin_percent: float | None


@router.get(
    "/{project_id}/financial-summary",
    response_model=ProjectFinancialSummary,
    dependencies=[Depends(require_read_only)]
)
async def get_project_financial_summary(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectFinancialSummary:
    """
    Get complete financial summary for a project including:
    - Proposal value (revenue)
    - Approved budget
    - Total income and expenses
    - Remaining budget
    - Profit (income - expenses) and margin
    """
    from sqlalchemy import func
    
    # Get project
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get linked proposal (if any)
    proposal_query = await db.execute(
        select(ProposalModel)
        .where(ProposalModel.project_id == project_id)
        .where(ProposalModel.organization_id == organization_id)
        .order_by(ProposalModel.created_at.desc())  # Get most recent
        .limit(1)
    )
    proposal = proposal_query.scalar_one_or_none()
    
    proposal_value_cents = proposal.total_amount_cents if proposal and proposal.total_amount_cents else 0
    proposal_status = proposal.status if proposal else None
    
    # Get total income (transactions of type 'income')
    income_result = await db.execute(
        select(func.coalesce(func.sum(TransactionModel.amount_cents), 0))
        .where(TransactionModel.project_id == project_id)
        .where(TransactionModel.organization_id == organization_id)
        .where(TransactionModel.type == "income")
        .where(TransactionModel.category != "internal_transfer")
        .where(TransactionModel.payment_status.in_(("approved", "paid")))
    )
    total_income_cents = income_result.scalar() or 0
    
    # Get total expenses (transactions of type 'expense')
    expense_result = await db.execute(
        select(func.coalesce(func.sum(TransactionModel.amount_cents), 0))
        .where(TransactionModel.project_id == project_id)
        .where(TransactionModel.organization_id == organization_id)
        .where(TransactionModel.type == "expense")
        .where(TransactionModel.category != "internal_transfer")
        .where(TransactionModel.payment_status.in_(("approved", "paid")))
    )
    total_expense_cents = expense_result.scalar() or 0
    
    # Calculate derivatives
    budget_total = project.budget_total_cents or 0
    remaining_budget = budget_total - total_expense_cents
    profit = total_income_cents - total_expense_cents
    
    # Profit margin as percentage of income
    profit_margin = None
    if total_income_cents > 0:
        profit_margin = round((profit / total_income_cents) * 100, 2)
    
    return ProjectFinancialSummary(
        project_id=project_id,
        proposal_value_cents=proposal_value_cents,
        proposal_status=proposal_status,
        budget_total_cents=budget_total,
        budget_status=project.budget_status or "draft",
        budget_approved_at=project.budget_approved_at,
        total_income_cents=total_income_cents,
        total_expense_cents=total_expense_cents,
        remaining_budget_cents=remaining_budget,
        profit_cents=profit,
        profit_margin_percent=profit_margin,
    )
