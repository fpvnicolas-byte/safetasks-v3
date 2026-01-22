from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Literal


class KitBase(BaseModel):
    """Base schema for Kit (equipment collection)."""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None  # camera, lighting, sound, grip, etc.
    status: Literal["available", "in_use", "maintenance", "retired"] = "available"
    image_url: Optional[str] = None  # URL to kit photo in Supabase Storage

    model_config = ConfigDict(from_attributes=True)


class KitCreate(KitBase):
    """Schema for creating a Kit."""
    pass


class KitUpdate(BaseModel):
    """Schema for updating a Kit."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[Literal["available", "in_use", "maintenance", "retired"]] = None

    model_config = ConfigDict(from_attributes=True)


class Kit(KitBase):
    """Schema for Kit response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class KitWithItems(Kit):
    """Schema for Kit response with equipment items."""
    # Note: In a full implementation, this would include equipment relationships
    # For now, keeping it simple as requested
    pass
