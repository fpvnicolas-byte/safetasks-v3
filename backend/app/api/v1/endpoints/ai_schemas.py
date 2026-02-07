"""
Pydantic schemas for AI endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class ScriptAnalysisRequest(BaseModel):
    """Request schema for script analysis"""
    project_id: UUID = Field(..., description="Project ID")
    analysis_type: str = Field(..., description="Type of analysis: full, characters, scenes, or locations")
    script_content: str = Field(..., description="Script content to analyze")
    force_new: bool = Field(False, description="If true, force a new analysis even if identical content was already analyzed")


class BudgetEstimationRequest(BaseModel):
    """Request schema for budget estimation"""
    project_id: UUID = Field(..., description="Project ID")
    estimation_type: str = Field(..., description="Type of estimation")
    script_content: str = Field(..., description="Script content to analyze")


class CallSheetSuggestionRequest(BaseModel):
    """Request schema for call sheet suggestions"""
    project_id: UUID = Field(..., description="Project ID")
    suggestion_type: str = Field(..., description="Type of suggestion")
    script_content: str = Field(..., description="Script content to analyze")


class TextAnalysisRequest(BaseModel):
    """Request schema for text analysis"""
    text: str = Field(..., description="Text content to analyze")
