from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from typing import List, Optional
import logging

from app.api.deps import (
    get_current_organization,
    require_admin_producer_or_finance,
    require_owner_admin_or_producer,
    require_read_only,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.commercial import stakeholder_service, stakeholder_crud_service
from app.services.financial import transaction_service
from app.services.notification_triggers import notify_expense_created
from app.core.config import settings
from app.models.scheduling import ShootingDay
from app.models.projects import Project
from app.models.organizations import Organization
from app.schemas.commercial import (
    StakeholderSummary,
    Stakeholder,
    StakeholderCreate,
    StakeholderUpdate,
    StakeholderWithRateInfo,
    StakeholderStatusUpdate,
)
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter()


# Legacy summary endpoint (keep for backward compatibility)
@router.get("/summary", dependencies=[Depends(require_admin_producer_or_finance)])
async def get_stakeholder_summary(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> StakeholderSummary:
    """
    Get a unified summary of all stakeholders in the organization.
    Includes clients (who pay), suppliers (who we pay), and crew (who work).
    """
    try:
        summary = await stakeholder_service.get_stakeholder_summary(
            db=db,
            organization_id=organization_id
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate stakeholder summary: {str(e)}"
        )


# CRUD Endpoints for Project Stakeholders
@router.get("/", response_model=List[Stakeholder], dependencies=[Depends(require_read_only)])
async def list_stakeholders(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    active_only: bool = Query(True, description="Only return active stakeholders"),
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    List all stakeholders in the organization.
    Optionally filter by project.
    """
    try:
        if project_id:
            await enforce_project_assignment(project_id, db, profile)
            stakeholders = await stakeholder_crud_service.get_by_project(
                db=db,
                organization_id=organization_id,
                project_id=project_id,
                active_only=active_only
            )
        else:
            filters = {}
            if get_effective_role(profile) == "freelancer":
                assigned_project_ids = await get_assigned_project_ids(db, profile)
                if not assigned_project_ids:
                    return []
                filters["project_id"] = assigned_project_ids

            stakeholders = await stakeholder_crud_service.get_multi(
                db=db,
                organization_id=organization_id,
                filters=filters if filters else None
            )
            if active_only:
                stakeholders = [s for s in stakeholders if s.is_active]

        return stakeholders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list stakeholders: {str(e)}"
        )


@router.post(
    "/",
    response_model=Stakeholder,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_stakeholder(
    stakeholder_in: StakeholderCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Create a new stakeholder for a project.

    If supplier_id is not provided, auto-creates a Supplier from the stakeholder's
    name/email/phone with category='freelancer'.

    If the stakeholder has a rate configured and FINANCIAL_AUTOMATION_ENABLED is True,
    an expense transaction will be automatically created for the project.

    Requires a default bank account to be configured if the stakeholder has a rate.
    Will reject if the expense would exceed the project budget.
    """
    from app.models.transactions import Transaction
    from app.models.commercial import Supplier as SupplierModel

    # Auto-create supplier if not provided
    if not stakeholder_in.supplier_id:
        new_supplier = SupplierModel(
            organization_id=organization_id,
            name=stakeholder_in.name,
            category="freelancer",
            email=stakeholder_in.email,
            phone=stakeholder_in.phone,
            is_active=True,
        )
        db.add(new_supplier)
        await db.flush()
        stakeholder_in.supplier_id = new_supplier.id

    # Pre-check: If stakeholder has a rate, ensure default bank account exists
    has_rate = (
        stakeholder_in.rate_value_cents is not None
        and stakeholder_in.rate_value_cents > 0
    )

    if has_rate and settings.FINANCIAL_AUTOMATION_ENABLED:
        org_result = await db.execute(
            select(Organization).where(Organization.id == organization_id)
        )
        organization = org_result.scalar_one_or_none()

        if not organization or not organization.default_bank_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add team member with rate: no default bank account configured. "
                       "Please set up a default bank account in Settings > Organization first."
            )

        # Budget limit validation
        project_result = await db.execute(
            select(Project).where(Project.id == stakeholder_in.project_id)
        )
        project = project_result.scalar_one_or_none()

        if project and project.budget_total_cents and project.budget_total_cents > 0:
            # Calculate the expense amount for this stakeholder
            shooting_days_count = 0
            sd_result = await db.execute(
                select(func.count(ShootingDay.id)).where(
                    ShootingDay.project_id == stakeholder_in.project_id
                )
            )
            shooting_days_count = sd_result.scalar() or 0

            # Calculate expense amount based on rate type
            rate_type = stakeholder_in.rate_type
            rate_value = stakeholder_in.rate_value_cents

            if rate_type == "fixed":
                expense_amount = rate_value
            elif rate_type == "daily":
                days = stakeholder_in.estimated_units or shooting_days_count or 1
                expense_amount = rate_value * days
            elif rate_type == "hourly":
                hours = stakeholder_in.estimated_units or 8
                expense_amount = rate_value * hours
            else:
                expense_amount = rate_value  # Fallback

            # Get current total expenses (pending + approved) for this project
            expenses_result = await db.execute(
                select(func.sum(Transaction.amount_cents)).where(
                    Transaction.project_id == stakeholder_in.project_id,
                    Transaction.type == "expense",
                    Transaction.payment_status.in_(["pending", "approved", "paid"])
                )
            )
            current_expenses = expenses_result.scalar() or 0

            # Check if adding this expense would exceed budget
            new_total = current_expenses + expense_amount
            if new_total > project.budget_total_cents:
                budget_formatted = f"R$ {project.budget_total_cents / 100:,.2f}"
                current_formatted = f"R$ {current_expenses / 100:,.2f}"
                expense_formatted = f"R$ {expense_amount / 100:,.2f}"
                over_formatted = f"R$ {(new_total - project.budget_total_cents) / 100:,.2f}"

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot add team member: expense ({expense_formatted}) would exceed project budget. "
                           f"Budget: {budget_formatted}, Current expenses: {current_formatted}, "
                           f"Over by: {over_formatted}. Please request a budget increment first."
                )

    try:
        stakeholder = await stakeholder_crud_service.create(
            db=db,
            obj_in=stakeholder_in,
            organization_id=organization_id
        )

        # Automatically create expense transaction if stakeholder has a rate
        if has_rate and settings.FINANCIAL_AUTOMATION_ENABLED:
            # Get shooting days count for daily rate calculation
            shooting_days_count = 0
            if stakeholder.project_id:
                sd_result = await db.execute(
                    select(func.count(ShootingDay.id)).where(
                        ShootingDay.project_id == stakeholder.project_id
                    )
                )
                shooting_days_count = sd_result.scalar() or 0

            try:
                # Create expense transaction
                expense = await transaction_service.create_expense_from_stakeholder(
                    db=db,
                    organization_id=organization_id,
                    stakeholder=stakeholder,
                    shooting_days_count=shooting_days_count
                )

                # Send notification about expense creation
                if expense and stakeholder.project_id:
                    project_result = await db.execute(
                        select(Project).where(Project.id == stakeholder.project_id)
                    )
                    project = project_result.scalar_one_or_none()
                    if project:
                        await notify_expense_created(
                            db=db,
                            organization_id=organization_id,
                            stakeholder_name=stakeholder.name,
                            project_title=project.title,
                            amount_cents=expense.amount_cents
                        )

                logger.info(
                    f"Auto-created expense for stakeholder {stakeholder.id}: "
                    f"{expense.amount_cents} cents"
                )
            except ValueError as ve:
                # Configuration issue (missing bank account, no rate configured, etc.)
                # Rollback the stakeholder creation by raising an error
                await db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(ve)
                )

        return stakeholder
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create stakeholder: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stakeholder: {str(e)}"
        )


@router.get("/{stakeholder_id}", response_model=Stakeholder, dependencies=[Depends(require_read_only)])
async def get_stakeholder(
    stakeholder_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific stakeholder by ID."""
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    await enforce_project_assignment(stakeholder.project_id, db, profile)

    return stakeholder


@router.get(
    "/{stakeholder_id}/rate-calculation",
    response_model=StakeholderWithRateInfo,
    dependencies=[Depends(require_read_only)]
)
async def get_stakeholder_rate_calculation(
    stakeholder_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get stakeholder with calculated payment amount and tracking.

    Returns:
    - suggested_amount_cents: calculated from rate × units (days/hours)
    - total_paid_cents: sum of transactions already paid
    - pending_amount_cents: suggested - paid
    - payment_status: not_configured, pending, partial, paid, overpaid
    - calculation_breakdown: details of how amount was calculated
    """
    result = await stakeholder_crud_service.get_with_rate_calculation(
        db=db,
        organization_id=organization_id,
        stakeholder_id=stakeholder_id
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    await enforce_project_assignment(result.project_id, db, profile)

    return result


@router.get(
    "/project/{project_id}/with-rates",
    response_model=List[StakeholderWithRateInfo],
    dependencies=[Depends(require_read_only)]
)
async def get_project_stakeholders_with_rates(
    project_id: UUID,
    active_only: bool = Query(True, description="Only return active stakeholders"),
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all stakeholders for a project with rate calculations and payment tracking.

    Useful for project financial summary showing expected costs vs paid amounts.
    """
    await enforce_project_assignment(project_id, db, profile)

    stakeholders = await stakeholder_crud_service.get_project_stakeholders_with_rates(
        db=db,
        organization_id=organization_id,
        project_id=project_id,
        active_only=active_only
    )

    return stakeholders


@router.put(
    "/{stakeholder_id}",
    response_model=Stakeholder,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_stakeholder(
    stakeholder_id: UUID,
    stakeholder_in: StakeholderUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update a stakeholder."""
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    try:
        updated_stakeholder = await stakeholder_crud_service.update(
            db=db,
            organization_id=organization_id,
            id=stakeholder_id,
            obj_in=stakeholder_in
        )
        return updated_stakeholder
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stakeholder: {str(e)}"
        )


@router.delete(
    "/{stakeholder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_stakeholder(
    stakeholder_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Delete a stakeholder and its associated pending expense transactions."""
    from app.models.transactions import Transaction

    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    try:
        # Delete associated pending expense transactions to prevent orphaned expenses
        # Only delete pending expenses - approved/paid ones are kept for financial records
        await db.execute(
            delete(Transaction).where(
                Transaction.stakeholder_id == stakeholder_id,
                Transaction.payment_status == "pending"
            )
        )
        
        await stakeholder_crud_service.remove(
            db=db,
            id=stakeholder_id,
            organization_id=organization_id
        )
        
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete stakeholder: {str(e)}"
        )


@router.patch(
    "/{stakeholder_id}/status",
    response_model=Stakeholder,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_stakeholder_status(
    stakeholder_id: UUID,
    status_update: StakeholderStatusUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the booking status of a stakeholder.

    Status workflow: requested → confirmed → working → completed
    Can also be set to 'cancelled' from any state.
    """
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    # Build update data
    update_data = {
        "status": status_update.status.value,
        "status_changed_at": datetime.now(timezone.utc),
    }

    if status_update.status_notes is not None:
        update_data["status_notes"] = status_update.status_notes
    if status_update.booking_start_date is not None:
        update_data["booking_start_date"] = status_update.booking_start_date
    if status_update.booking_end_date is not None:
        update_data["booking_end_date"] = status_update.booking_end_date
    if status_update.confirmed_rate_cents is not None:
        update_data["confirmed_rate_cents"] = status_update.confirmed_rate_cents
    if status_update.confirmed_rate_type is not None:
        update_data["confirmed_rate_type"] = status_update.confirmed_rate_type

    # Apply updates
    for field, value in update_data.items():
        setattr(stakeholder, field, value)

    await db.commit()
    await db.refresh(stakeholder)

    # Trigger automatic expense creation when status becomes "confirmed"
    if (
        status_update.status.value == "confirmed"
        and settings.FINANCIAL_AUTOMATION_ENABLED
        and (stakeholder.confirmed_rate_cents or stakeholder.rate_value_cents)
    ):
        try:
            # Get shooting days count for the project (for daily rate calculation)
            shooting_days_result = await db.execute(
                select(func.count(ShootingDay.id)).where(
                    ShootingDay.project_id == stakeholder.project_id
                )
            )
            shooting_days_count = shooting_days_result.scalar() or 0

            # Create expense transaction
            transaction = await transaction_service.create_expense_from_stakeholder(
                db=db,
                organization_id=organization_id,
                stakeholder=stakeholder,
                shooting_days_count=shooting_days_count
            )

            # Get project title for notification
            project_result = await db.execute(
                select(Project).where(Project.id == stakeholder.project_id)
            )
            project = project_result.scalar_one_or_none()
            project_title = project.title if project else "Unknown Project"

            # Send notification about expense creation
            await notify_expense_created(
                db=db,
                organization_id=organization_id,
                stakeholder_name=stakeholder.name,
                project_title=project_title,
                amount_cents=transaction.amount_cents
            )

            await db.commit()
            logger.info(
                f"Auto-created expense for stakeholder {stakeholder.id}: "
                f"R$ {transaction.amount_cents / 100:.2f}"
            )
        except ValueError as e:
            # Log but don't fail - expense creation is best-effort
            logger.warning(f"Could not create expense for stakeholder {stakeholder.id}: {e}")
        except Exception as e:
            logger.error(f"Error creating expense for stakeholder {stakeholder.id}: {e}")

    return stakeholder


@router.get(
    "/project/{project_id}/by-status",
    response_model=dict,
    dependencies=[Depends(require_read_only)]
)
async def get_project_stakeholders_by_status(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get stakeholders for a project grouped by booking status.

    Returns a dict with status as keys and lists of stakeholders as values.
    """
    await enforce_project_assignment(project_id, db, profile)

    stakeholders = await stakeholder_crud_service.get_by_project(
        db=db,
        organization_id=organization_id,
        project_id=project_id,
        active_only=True
    )

    # Group by status
    grouped = {
        "requested": [],
        "confirmed": [],
        "working": [],
        "completed": [],
        "cancelled": [],
    }

    for s in stakeholders:
        status_key = s.status.value if hasattr(s.status, 'value') else str(s.status)
        if status_key in grouped:
            grouped[status_key].append(s)

    return grouped
