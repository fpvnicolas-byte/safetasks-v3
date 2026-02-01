from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date, time
from typing import Optional, List, Literal
from enum import Enum


class DayNight(str, Enum):
    day = "day"
    night = "night"
    dawn = "dawn"
    dusk = "dusk"


class InternalExternal(str, Enum):
    internal = "internal"
    external = "external"


class ShootingDayStatus(str, Enum):
    draft = "draft"
    confirmed = "confirmed"
    completed = "completed"


class SceneBase(BaseModel):
    """Base schema for Scene."""
    scene_number: int = Field(..., gt=0)
    heading: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    day_night: DayNight
    internal_external: InternalExternal
    estimated_time_minutes: int = Field(..., gt=0)
    shooting_day_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class SceneCreate(SceneBase):
    """Schema for creating a Scene."""
    project_id: UUID


class SceneUpdate(BaseModel):
    """Schema for updating a Scene."""
    scene_number: Optional[int] = Field(None, gt=0)
    heading: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=1)
    day_night: Optional[DayNight] = None
    internal_external: Optional[InternalExternal] = None
    estimated_time_minutes: Optional[int] = Field(None, gt=0)
    shooting_day_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class Scene(SceneBase):
    """Schema for Scene response."""
    id: UUID
    organization_id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class SceneWithCharacters(Scene):
    """Schema for Scene response with characters."""
    characters: List["Character"] = []

    model_config = ConfigDict(from_attributes=True)


class CharacterBase(BaseModel):
    """Base schema for Character."""
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    actor_name: Optional[str] = None
    project_id: UUID

    model_config = ConfigDict(from_attributes=True)


class CharacterCreate(CharacterBase):
    """Schema for creating a Character."""
    pass


class CharacterUpdate(BaseModel):
    """Schema for updating a Character."""
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=1)
    actor_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Character(CharacterBase):
    """Schema for Character response."""
    id: UUID
    organization_id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class CharacterWithScenes(Character):
    """Schema for Character response with scenes."""
    scenes: List[Scene] = []

    model_config = ConfigDict(from_attributes=True)


class SceneCharacterCreate(BaseModel):
    """Schema for linking a character to a scene."""
    character_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ShootingDayBase(BaseModel):
    """Base schema for Shooting Day."""
    date: date
    status: ShootingDayStatus = ShootingDayStatus.draft
    call_time: time
    on_set: Optional[time] = None
    lunch_time: Optional[time] = None
    wrap_time: Optional[time] = None
    location_name: str = Field(..., min_length=1)
    location_address: Optional[str] = None
    weather_forecast: Optional[str] = None
    notes: Optional[str] = None
    parking_info: Optional[str] = None
    hospital_info: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ShootingDayCreate(ShootingDayBase):
    """Schema for creating a Shooting Day."""
    project_id: UUID


class ShootingDayUpdate(BaseModel):
    """Schema for updating a Shooting Day."""
    date: Optional[date] = None
    status: Optional[ShootingDayStatus] = None
    call_time: Optional[time] = None
    on_set: Optional[time] = None
    lunch_time: Optional[time] = None
    wrap_time: Optional[time] = None
    location_name: Optional[str] = Field(None, min_length=1)
    location_address: Optional[str] = None
    weather_forecast: Optional[str] = None
    notes: Optional[str] = None
    parking_info: Optional[str] = None
    hospital_info: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectSummary(BaseModel):
    """Simplified project information."""
    id: UUID
    title: str
    client: Optional["ClientSummary"] = None

    model_config = ConfigDict(from_attributes=True)


class ClientSummary(BaseModel):
    """Simplified client information."""
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class ShootingDay(ShootingDayBase):
    """Schema for Shooting Day response."""
    id: UUID
    organization_id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectSummary] = None


class ShootingDayWithScenes(ShootingDay):
    """Schema for Shooting Day response with scenes."""
    scenes: List[Scene] = []

    model_config = ConfigDict(from_attributes=True)


class ProjectBreakdown(BaseModel):
    """Schema for complete project breakdown response."""
    project_id: UUID
    project_title: str
    characters: List[Character]
    scenes: List[SceneWithCharacters]
    shooting_days: List[ShootingDayWithScenes]

    model_config = ConfigDict(from_attributes=True)


class AIScriptAnalysisCommit(BaseModel):
    """Schema for committing AI script analysis to database."""
    analysis_data: dict  # The JSON result from AI analysis

    model_config = ConfigDict(from_attributes=True)
