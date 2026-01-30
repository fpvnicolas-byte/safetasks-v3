from pydantic import BaseModel, ConfigDict, Field, Json
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any


class NotificationBase(BaseModel):
    """Base schema for Notification."""
    title: str
    message: str
    type: str  # info, warning, success, error

    model_config = ConfigDict(from_attributes=True)


class NotificationCreate(NotificationBase):
    """Schema for creating a Notification."""
    profile_id: UUID
    metadata: Optional[Dict[str, Any]] = None


class NotificationUpdate(BaseModel):
    """Schema for updating a Notification."""
    is_read: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class Notification(NotificationBase):
    """Schema for Notification response."""
    id: UUID
    organization_id: UUID
    profile_id: UUID
    is_read: bool
    metadata: Optional[Json[Dict[str, Any]]] = Field(default=None, validation_alias="notification_metadata")
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationStats(BaseModel):
    """Schema for notification statistics."""
    total_count: int
    unread_count: int
    read_count: int

    model_config = ConfigDict(from_attributes=True)
