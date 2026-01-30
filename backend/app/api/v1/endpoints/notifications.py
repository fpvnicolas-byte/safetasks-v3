from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, get_current_profile
from app.db.session import get_db
from app.services.notifications import notification_service
from app.schemas.notifications import Notification, NotificationStats


router = APIRouter()


@router.get("/", response_model=List[Notification])
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


@router.get("/stats", response_model=NotificationStats)
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


@router.patch("/{notification_id}/read")
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


@router.patch("/mark-all-read")
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
