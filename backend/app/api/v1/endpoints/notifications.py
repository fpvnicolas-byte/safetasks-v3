from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_profile, require_billing_active, require_billing_read
from app.db.session import get_db
from app.services.notifications import notification_service
from app.schemas.notifications import Notification, NotificationStats


router = APIRouter()


class CreateTestNotificationRequest(BaseModel):
    """Request model for creating test notifications"""
    title: str
    message: str
    type: str = "info"  # info, success, warning, error


@router.get("/", response_model=List[Notification], dependencies=[Depends(require_billing_read())])
async def get_notifications(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False, description="Show only unread notifications"),
) -> List[Notification]:
    """
    Get notifications for the current user.
    """
    # logger.info(f"Fetching notifications for user {profile.id} in org {profile.organization_id}")
    notifications = await notification_service.get_user_notifications(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only
    )
    return notifications


@router.get("/stats", response_model=NotificationStats, dependencies=[Depends(require_billing_read())])
async def get_notification_stats(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> NotificationStats:
    """
    Get notification statistics for the current user.
    """
    total_count = len(await notification_service.get_user_notifications(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id,
        limit=1000  # Get all for count
    ))

    unread_count = await notification_service.get_unread_count(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id
    )

    return NotificationStats(
        total_count=total_count,
        unread_count=unread_count,
        read_count=total_count - unread_count
    )


@router.patch("/{notification_id}/read", dependencies=[Depends(require_billing_active())])
async def mark_notification_as_read(
    notification_id: UUID,
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Mark a specific notification as read.
    """
    notification = await notification_service.mark_as_read(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id,
        notification_id=notification_id
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or does not belong to you"
        )

    return {"message": "Notification marked as read", "notification_id": notification_id}


@router.patch("/mark-all-read", dependencies=[Depends(require_billing_active())])
async def mark_all_notifications_as_read(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Mark all notifications as read for the current user.
    """
    updated_count = await notification_service.mark_all_as_read(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id
    )

    return {"message": f"Marked {updated_count} notifications as read"}


@router.post("/test/create", dependencies=[Depends(require_billing_active())])
async def create_test_notification(
    request: CreateTestNotificationRequest,
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a test notification for the current user.
    Useful for testing the notification system.

    Types: info, success, warning, error
    """
    notification = await notification_service.create_for_user(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id,
        title=request.title,
        message=request.message,
        type=request.type,
        metadata={"test": True, "created_via": "test_endpoint"}
    )

    return {
        "message": "Test notification created successfully",
        "notification_id": str(notification.id),
        "title": notification.title,
        "type": notification.type
    }


@router.delete("/{notification_id}", dependencies=[Depends(require_billing_active())])
async def delete_notification(
    notification_id: UUID,
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete a specific notification.
    """
    deleted = await notification_service.delete_notification(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id,
        notification_id=notification_id
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or does not belong to you"
        )

    return {"message": "Notification deleted", "notification_id": str(notification_id)}


@router.delete("/", dependencies=[Depends(require_billing_active())])
async def delete_all_notifications(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete all notifications for the current user.
    """
    deleted_count = await notification_service.delete_all_notifications(
        db=db,
        organization_id=profile.organization_id,
        profile_id=profile.id
    )

    return {"message": f"Deleted {deleted_count} notifications"}

