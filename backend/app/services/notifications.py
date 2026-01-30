import json
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.services.base import BaseService
from app.models.notifications import Notification
from app.models.profiles import Profile
from app.schemas.notifications import NotificationCreate, NotificationUpdate

logger = logging.getLogger(__name__)


class NotificationService(BaseService[Notification, NotificationCreate, NotificationUpdate]):
    """Service for managing internal notifications."""

    def __init__(self):
        super().__init__(Notification)

    async def create_for_user(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        profile_id: UUID,
        title: str,
        message: str,
        type: str = "info",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Create a notification for a specific user."""
        from app.schemas.notifications import NotificationCreate

        notification_data = NotificationCreate(
            title=title,
            message=message,
            type=type,
            profile_id=profile_id,
            metadata=metadata
        )

        # Override the organization_id filtering for this specific case
        # since we're creating for a specific user
        notification = Notification(
            organization_id=organization_id,
            profile_id=profile_id,
            title=title,
            message=message,
            type=type,
            notification_metadata=json.dumps(metadata) if metadata else None
        )

        db.add(notification)
        await db.flush()
        await db.refresh(notification)
        return notification

    async def get_user_notifications(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        profile_id: UUID,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False
    ) -> List[Notification]:
        """Get notifications for a specific user."""
        query = select(Notification).where(
            Notification.organization_id == organization_id,
            Notification.profile_id == profile_id
        )

        if unread_only:
            query = query.where(Notification.is_read == False)

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def mark_as_read(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        profile_id: UUID,
        notification_id: UUID
    ) -> Optional[Notification]:
        """Mark a notification as read."""
        from sqlalchemy import update
        from datetime import datetime, timezone

        # First check ownership
        notification = await self.get(db=db, organization_id=organization_id, id=notification_id)
        if not notification or notification.profile_id != profile_id:
            return None

        # Update the notification
        query = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.organization_id == organization_id,
                Notification.profile_id == profile_id
            )
            .values(
                is_read=True,
                read_at=func.now()
            )
        )

        await db.execute(query)

        # Return updated notification
        return await self.get(db=db, organization_id=organization_id, id=notification_id)

    async def mark_all_as_read(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        profile_id: UUID
    ) -> int:
        """Mark all notifications as read for a user. Returns count of updated notifications."""
        from sqlalchemy import update

        query = (
            update(Notification)
            .where(
                Notification.organization_id == organization_id,
                Notification.profile_id == profile_id,
                Notification.is_read == False
            )
            .values(
                is_read=True,
                read_at=func.now()
            )
        )

        result = await db.execute(query)
        return result.rowcount

    async def get_unread_count(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        profile_id: UUID
    ) -> int:
        """Get count of unread notifications for a user."""
        query = select(func.count(Notification.id)).where(
            Notification.organization_id == organization_id,
            Notification.profile_id == profile_id,
            Notification.is_read == False
        )

        result = await db.execute(query)
        return result.scalar() or 0

    async def send_external_notification(
        self,
        *,
        organization_id: UUID,
        profile_id: UUID,
        title: str,
        message: str,
        channels: List[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send external notifications via email, WhatsApp, etc.
        This is a placeholder for future integration.
        """
        if channels is None:
            channels = ["email"]  # Default to email

        results = {}

        for channel in channels:
            try:
                if channel == "email":
                    result = await self._send_email_notification(
                        organization_id=organization_id,
                        profile_id=profile_id,
                        title=title,
                        message=message,
                        metadata=metadata
                    )
                    results["email"] = result

                elif channel == "whatsapp":
                    result = await self._send_whatsapp_notification(
                        organization_id=organization_id,
                        profile_id=profile_id,
                        title=title,
                        message=message,
                        metadata=metadata
                    )
                    results["whatsapp"] = result

                else:
                    logger.warning(f"Unknown notification channel: {channel}")
                    results[channel] = {"status": "error", "error": "Unknown channel"}

            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {str(e)}")
                results[channel] = {"status": "error", "error": str(e)}

        return results

    async def _send_email_notification(
        self,
        *,
        organization_id: UUID,
        profile_id: UUID,
        title: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send email notification (placeholder for Resend integration)."""
        logger.info(
            f"EMAIL_NOTIFICATION: Would send email to user {profile_id} "
            f"in organization {organization_id}: {title}"
        )

        # In a real implementation, this would:
        # 1. Get user email from profile
        # 2. Send email via Resend API
        # 3. Return delivery status

        return {
            "channel": "email",
            "status": "success",
            "provider": "resend",
            "message_id": f"email_{organization_id}_{profile_id}_{title.replace(' ', '_')}"
        }

    async def _send_whatsapp_notification(
        self,
        *,
        organization_id: UUID,
        profile_id: UUID,
        title: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send WhatsApp notification (placeholder for Evolution API integration)."""
        logger.info(
            f"WHATSAPP_NOTIFICATION: Would send WhatsApp to user {profile_id} "
            f"in organization {organization_id}: {title}"
        )

        # In a real implementation, this would:
        # 1. Get user phone from profile
        # 2. Send WhatsApp via Evolution API
        # 3. Return delivery status

        return {
            "channel": "whatsapp",
            "status": "success",
            "provider": "evolution_api",
            "message_id": f"wa_{organization_id}_{profile_id}_{title.replace(' ', '_')}"
        }


# Global notification service instance
notification_service = NotificationService()
