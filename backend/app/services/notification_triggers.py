"""Notification triggers for key business events."""
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform import PlatformAdminUser
from app.models.profiles import Profile
from app.services.notifications import notification_service


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


async def notify_platform_superadmins(
    db: AsyncSession,
    *,
    title: str,
    message: str,
    type: str = "info",
    metadata: Optional[Dict[str, Any]] = None,
    source_organization_id: Optional[UUID] = None,
) -> None:
    """Send notification only to active platform superadmins."""
    query = (
        select(Profile)
        .join(PlatformAdminUser, PlatformAdminUser.profile_id == Profile.id)
        .where(
            PlatformAdminUser.is_active == True,
            PlatformAdminUser.role == "superadmin",
        )
    )
    result = await db.execute(query)
    superadmins = result.scalars().all()

    for profile in superadmins:
        if not profile.organization_id:
            # Notification model requires organization_id; skip profiles outside org scope.
            continue

        final_metadata = dict(metadata or {})
        if source_organization_id:
            final_metadata.setdefault("source_organization_id", str(source_organization_id))

        await notification_service.create_for_user(
            db=db,
            organization_id=profile.organization_id,
            profile_id=profile.id,
            title=title,
            message=message,
            type=type,
            metadata=final_metadata,
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
        title="invoice_status_changed_title",
        message="invoice_status_changed_message",
        type=type_map.get(new_status, "info"),
        metadata={
            "invoice_id": str(invoice_id),
            "invoice_number": invoice_number,
            "old_status": old_status,
            "new_status": new_status,
            "client_name": client_name or "",
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
        title = "budget_exceeded_title"
        message = "budget_exceeded_message"
        type = "error"
    elif percent_spent >= 80:
        title = "budget_warning_title"
        message = "budget_warning_message"
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
            "project_title": project_title,
            "category": category,
            "percent_spent": f"{percent_spent:.0f}",
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
    status_message_keys = {
        "confirmed": "crew_status_confirmed_message",
        "cancelled": "crew_status_cancelled_message",
        "completed": "crew_status_completed_message",
    }

    message_key = status_message_keys.get(new_status)
    if not message_key:
        return

    await notify_organization_admins(
        db=db,
        organization_id=organization_id,
        title="crew_status_changed_title",
        message=message_key,
        type="success" if new_status in ["confirmed", "completed"] else "warning",
        metadata={
            "stakeholder_name": stakeholder_name,
            "project_title": project_title,
            "status": new_status,
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
        title="expense_created_title",
        message="expense_created_message",
        type="info",
        metadata={
            "stakeholder_name": stakeholder_name,
            "project_title": project_title,
            "amount_cents": amount_cents,
            "amount": amount_formatted,
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
        title="income_created_title",
        message="income_created_message",
        type="success",
        metadata={
            "invoice_number": invoice_number,
            "client_name": client_name,
            "amount_cents": amount_cents,
            "amount": amount_formatted,
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
        title="project_started_title",
        message="project_started_message",
        type="success",
        metadata={
            "project_id": str(project_id),
            "project_title": project_title,
            "budget_cents": budget_cents,
            "budget": budget_formatted,
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
        title="project_completed_title",
        message="project_completed_message",
        type="success",
        metadata={
            "project_id": str(project_id),
            "project_title": project_title,
            "status": "delivered",
        }
    )
