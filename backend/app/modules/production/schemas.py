from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

from app.core.schemas import BaseSchema, CreateSchema, UpdateSchema


# Script Schemas
class ScriptBase(BaseModel):
    """Base schema for script data."""
    title: str = Field(..., max_length=255)
    content_text: str = Field(..., description="Full script text content")
    file_name: Optional[str] = Field(None, max_length=255)
    mime_type: Optional[str] = Field(None, max_length=100)


class ScriptCreate(ScriptBase, CreateSchema):
    """Schema for creating a new script."""
    pass


class ScriptUpdate(ScriptBase, UpdateSchema):
    """Schema for updating an existing script."""
    processed: Optional[bool] = None


class ScriptRead(BaseSchema):
    """Schema for reading script data."""
    model_config = ConfigDict(from_attributes=True)

    title: str
    processed: bool
    file_name: Optional[str]
    file_size_bytes: Optional[int]
    mime_type: Optional[str]
    created_by: str
    processed_at: Optional[datetime]

    # Related data
    scenes_count: Optional[int] = Field(default=0, description="Number of scenes")
    breakdown_items_count: Optional[int] = Field(default=0, description="Total breakdown items")


# Scene Schemas
class SceneBase(BaseModel):
    """Base schema for scene data."""
    scene_number: str = Field(..., max_length=50, description="Scene number (e.g., '1A', 'EXT-001')")
    heading: str = Field(..., max_length=255, description="INT/EXT LOCATION - TIME")
    description: str = Field(..., description="Scene description")
    time_of_day: Optional[str] = Field(None, max_length=50, description="DAY, NIGHT, etc.")
    location: Optional[str] = Field(None, max_length=255, description="Location details")
    estimated_duration_minutes: Optional[int] = Field(None, ge=0, description="Estimated shooting time")
    complexity_level: Optional[str] = Field(None, description="LOW, MEDIUM, HIGH, VERY_HIGH")


class SceneCreate(SceneBase, CreateSchema):
    """Schema for creating a new scene."""
    script_id: int


class SceneUpdate(SceneBase, UpdateSchema):
    """Schema for updating an existing scene."""
    pass


class SceneRead(BaseSchema):
    """Schema for reading scene data."""
    model_config = ConfigDict(from_attributes=True)

    script_id: int
    scene_number: str
    heading: str
    description: str
    time_of_day: Optional[str]
    location: Optional[str]
    estimated_duration_minutes: Optional[int]
    complexity_level: Optional[str]
    is_active: bool

    # Related data
    breakdown_items: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


# Breakdown Item Schemas
class BreakdownItemBase(BaseModel):
    """Base schema for breakdown item data."""
    category: str = Field(..., max_length=100, description="Item category")
    subcategory: Optional[str] = Field(None, max_length=100, description="Item subcategory")
    name: str = Field(..., max_length=255, description="Item name")
    description: Optional[str] = Field(None, description="Item description")
    quantity: int = Field(default=1, ge=1, description="Item quantity")
    usage_type: Optional[str] = Field(None, max_length=50, description="HERO, BACKGROUND, etc.")
    special_requirements: Optional[str] = Field(None, description="Special requirements")
    preparation_notes: Optional[str] = Field(None, description="Preparation notes")
    is_confirmed: bool = False


class BreakdownItemCreate(BreakdownItemBase, CreateSchema):
    """Schema for creating a new breakdown item."""
    scene_id: int


class BreakdownItemUpdate(BreakdownItemBase, UpdateSchema):
    """Schema for updating an existing breakdown item."""
    pass


class BreakdownItemRead(BaseSchema):
    """Schema for reading breakdown item data."""
    model_config = ConfigDict(from_attributes=True)

    scene_id: int
    category: str
    subcategory: Optional[str]
    name: str
    description: Optional[str]
    quantity: int
    usage_type: Optional[str]
    special_requirements: Optional[str]
    preparation_notes: Optional[str]
    is_confirmed: bool
    is_active: bool


# API Request/Response Schemas
class ScriptUploadRequest(BaseModel):
    """Schema for script upload requests."""
    title: str = Field(..., max_length=255, description="Script title")
    # File will be handled separately via multipart upload


class ScriptUploadResponse(BaseModel):
    """Schema for script upload responses."""
    script_id: int
    title: str
    file_name: str
    file_size_bytes: int
    message: str = "Script uploaded successfully. Processing breakdown..."


class ScriptBreakdownResponse(BaseModel):
    """Schema for script breakdown processing responses."""
    script_id: int
    scenes_created: int
    breakdown_items_created: int
    processing_status: str
    message: str


class ScriptBreakdownStatistics(BaseModel):
    """Schema for script breakdown statistics."""
    script_id: int
    total_scenes: int
    total_breakdown_items: int
    items_by_category: Dict[str, int]


class SceneWithBreakdown(BaseModel):
    """Schema for scenes with their breakdown items."""
    scene: SceneRead
    breakdown_items: List[BreakdownItemRead]


class ScriptWithBreakdown(BaseModel):
    """Schema for complete script with all scenes and breakdown items."""
    script: ScriptRead
    scenes: List[SceneWithBreakdown]
    total_scenes: int
    total_breakdown_items: int


# Filter Schemas
class ScriptFilter(BaseModel):
    """Filter parameters for script queries."""
    search: Optional[str] = None
    processed: Optional[bool] = None
    created_by: Optional[str] = None


class SceneFilter(BaseModel):
    """Filter parameters for scene queries."""
    script_id: Optional[int] = None
    search: Optional[str] = None
    time_of_day: Optional[str] = None
    complexity_level: Optional[str] = None
    is_active: Optional[bool] = True


class BreakdownItemFilter(BaseModel):
    """Filter parameters for breakdown item queries."""
    scene_id: Optional[int] = None
    category: Optional[str] = None
    search: Optional[str] = None
    is_confirmed: Optional[bool] = None
    is_active: Optional[bool] = True


# AI Analysis Schemas
class AISceneAnalysis(BaseModel):
    """Schema for AI-analyzed scene data."""
    number: str
    heading: str
    description: str
    time: Optional[str] = None
    location: Optional[str] = None
    breakdown_items: List[Dict[str, Any]] = Field(default_factory=list)


class AIScriptAnalysis(BaseModel):
    """Schema for complete AI script analysis."""
    scenes: List[AISceneAnalysis]