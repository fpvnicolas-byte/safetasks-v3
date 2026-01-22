from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date, time
from typing import Optional


class CallSheetBase(BaseModel):
    """Base schema for Call Sheet."""
    project_id: UUID
    shooting_date: date
    location_name: str = Field(..., min_length=1)
    location_address: str = Field(..., min_length=1)
    weather_forecast: Optional[str] = None
    crew_call: time
    on_set: time
    lunch_time: Optional[time] = None
    wrap_time: Optional[time] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CallSheetCreate(CallSheetBase):
    """Schema for creating a Call Sheet."""
    pass


class CallSheetUpdate(BaseModel):
    """Schema for updating a Call Sheet."""
    project_id: Optional[UUID] = None
    shooting_date: Optional[date] = None
    location_name: Optional[str] = Field(None, min_length=1)
    location_address: Optional[str] = Field(None, min_length=1)
    weather_forecast: Optional[str] = None
    crew_call: Optional[time] = None
    on_set: Optional[time] = None
    lunch_time: Optional[time] = None
    wrap_time: Optional[time] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CallSheet(CallSheetBase):
    """Schema for Call Sheet response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class CallSheetWithProject(CallSheet):
    """Schema for Call Sheet response with basic project info."""
    # Note: In full implementation, this would include project relationship
    # For now, keeping it simple as requested
    pass
