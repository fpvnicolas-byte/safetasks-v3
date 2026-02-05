"""Notification triggers for key business events."""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.notifications import notification_service
from app.models.profiles import Profile


async def notify_organization_admins(
    db: AsyncSession,
    organization_id: UUID,
    title: str,
    message: str,
    type: str = "info",
    metadata: dict = None
):
    """Send notification to all admin/manager users in organization."""
    query = select(Profile).where(
        Profile.organization_id == organization_id,
        Profile.role.in_(["admin", "manager", "owner"])
    )
    result = await db.execute(query)
    profiles = result.scalars().all()

    for profile in profiles:
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile.id,
            title=title,
            message=message,
            type=type,
            metadata=metadata
        )


async def notify_invoice_status_change(
    db: AsyncSession,
    organization_id: UUID,
    invoice_id: UUID,
    invoice_number: str,
    old_status: str,
    new_status: str,
    client_name: str = None
):
    """Notify when invoice status changes."""
    type_map = {
        "paid": "success",
        "overdue": "warning",
        "cancelled": "error",
        "sent": "info"
    }

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title=f"Invoice {new_status.title()}",
        message=f"Invoice {invoice_number}{' for ' + client_name if client_name else ''} is now {new_status}",
        type=type_map.get(new_status, "info"),
        metadata={
            "invoice_id": str(invoice_id),
            "invoice_number": invoice_number,
            "old_status": old_status,
            "new_status": new_status
        }
    )


async def notify_budget_threshold(
    db: AsyncSession,
    organization_id: UUID,
    project_id: UUID,
    project_title: str,
    category: str,
    percent_spent: float
):
    """Notify when budget category exceeds threshold."""
    if percent_spent >= 100:
        title = "Budget Exceeded"
        message = f"{project_title}: {category} budget is {percent_spent:.0f}% spent (over budget!)"
        type = "error"
    elif percent_spent >= 80:
        title = "Budget Warning"
        message = f"{project_title}: {category} budget is {percent_spent:.0f}% spent"
        type = "warning"
    else:
        return  # No notification needed

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title=title,
        message=message,
        type=type,
        metadata={
            "project_id": str(project_id),
            "category": category,
            "percent_spent": percent_spent
        }
    )


async def notify_stakeholder_status_change(
    db: AsyncSession,
    organization_id: UUID,
    stakeholder_name: str,
    project_title: str,
    new_status: str
):
    """Notify when stakeholder booking status changes."""
    status_messages = {
        "confirmed": f"{stakeholder_name} confirmed for {project_title}",
        "cancelled": f"{stakeholder_name} booking cancelled for {project_title}",
        "completed": f"{stakeholder_name} completed work on {project_title}",
    }

    if new_status not in status_messages:
        return

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title=f"Crew {new_status.title()}",
        message=status_messages[new_status],
        type="success" if new_status in ["confirmed", "completed"] else "warning",
        metadata={
            "stakeholder_name": stakeholder_name,
            "project_title": project_title,
            "status": new_status
        }
    )


async def notify_expense_created(
    db: AsyncSession,
    organization_id: UUID,
    stakeholder_name: str,
    project_title: str,
    amount_cents: int
):
    """Notify admins when an automatic expense is created for a team member."""
    amount_formatted = f"R$ {amount_cents / 100:,.2f}"

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title="Expense Created",
        message=f"Automatic expense created: {stakeholder_name} on {project_title} - {amount_formatted}",
        type="info",
        metadata={
            "stakeholder_name": stakeholder_name,
            "project_title": project_title,
            "amount_cents": amount_cents
        }
    )


async def notify_income_created(
    db: AsyncSession,
    organization_id: UUID,
    invoice_number: str,
    client_name: str,
    amount_cents: int
):
    """Notify admins when an automatic income is created from invoice payment."""
    amount_formatted = f"R$ {amount_cents / 100:,.2f}"

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title="Income Created",
        message=f"Invoice {invoice_number} paid by {client_name} - {amount_formatted} added to balance",
        type="success",
        metadata={
            "invoice_number": invoice_number,
            "client_name": client_name,
            "amount_cents": amount_cents
        }
    )


async def notify_project_created(
    db: AsyncSession,
    organization_id: UUID,
    project_title: str,
    project_id: UUID,
    budget_cents: int
):
    """Notify admins when a new project is created/started (budget confirmed)."""
    budget_formatted = f"R$ {budget_cents / 100:,.2f}"

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title="Project Started",
        message=f"New project '{project_title}' started. Budget confirmed: {budget_formatted}",
        type="success",
        metadata={
            "project_id": str(project_id),
            "project_title": project_title,
            "budget_cents": budget_cents
        }
    )


async def notify_project_finished(
    db: AsyncSession,
    organization_id: UUID,
    project_title: str,
    project_id: UUID
):
    """Notify admins when a project is marked as finished/delivered."""
    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title="Project Completed",
        message=f"Project '{project_title}' has been marked as completed/delivered.",
        type="success",
        metadata={
            "project_id": str(project_id),
            "project_title": project_title,
            "status": "delivered"
        }
    )
