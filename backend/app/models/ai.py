"""
AI Features Database Models

Models for storing AI analysis results, suggestions, recommendations, and usage tracking.
"""
from sqlalchemy import Column, String, TIMESTAMP, Boolean, BIGINT, Integer, Float, Text, func, ForeignKey, CheckConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class ScriptAnalysis(Base):
    """
    AI Script Analysis Results
    
    Stores the results of AI-powered script analysis including extracted
    characters, scenes, locations, and production requirements.
    """
    __tablename__ = "script_analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Analysis content
    script_text = Column(Text, nullable=False)
    analysis_result = Column(JSONB, nullable=False)  # Structured analysis results
    analysis_type = Column(String, nullable=False)  # full, characters, scenes, locations
    
    # Quality metrics
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    
    # Cost tracking
    token_count = Column(Integer)  # Tokens used in this analysis
    cost_cents = Column(BIGINT)  # Estimated cost in cents
    
    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        CheckConstraint("analysis_type IN ('full', 'characters', 'scenes', 'locations')"),
        CheckConstraint("confidence >= 0 AND confidence <= 1"),
    )


class AiSuggestion(Base):
    """
    AI-Generated Production Suggestions
    
    Stores AI-generated suggestions for optimizing production workflow,
    reducing costs, and improving efficiency.
    """
    __tablename__ = "ai_suggestions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Suggestion details
    suggestion_type = Column(String, nullable=False)  # budget, schedule, casting, logistics, equipment, other
    suggestion_text = Column(Text, nullable=False)
    
    # Quality and priority
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    priority = Column(String, nullable=False)  # low, medium, high
    
    # Context
    related_scenes = Column(JSONB)  # Array of scene numbers
    
    # Impact estimation
    estimated_savings_cents = Column(BIGINT)  # Potential cost savings
    estimated_time_saved_minutes = Column(Integer)  # Potential time savings
    
    # Status
    is_applied = Column(Boolean, default=False)  # Whether suggestion was implemented
    
    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        CheckConstraint("suggestion_type IN ('budget', 'schedule', 'casting', 'logistics', 'equipment', 'other')"),
        CheckConstraint("priority IN ('low', 'medium', 'high')"),
        CheckConstraint("confidence >= 0 AND confidence <= 1"),
    )


class AiRecommendation(Base):
    """
    AI-Generated Production Recommendations
    
    Stores high-priority AI recommendations for call sheets, budgets,
    schedules, and equipment planning.
    """
    __tablename__ = "ai_recommendations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Recommendation details
    recommendation_type = Column(String, nullable=False)  # call_sheet, budget, schedule, equipment
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    
    # Quality and priority
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    priority = Column(String, nullable=False)  # low, medium, high
    
    # Action items
    action_items = Column(JSONB, nullable=False)  # Array of action items
    
    # Impact estimation
    estimated_impact = Column(JSONB)  # {time_saved_minutes, cost_saved_cents, risk_reduction}
    
    # Status
    is_implemented = Column(Boolean, default=False)  # Whether recommendation was implemented
    
    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        CheckConstraint("recommendation_type IN ('call_sheet', 'budget', 'schedule', 'equipment')"),
        CheckConstraint("priority IN ('low', 'medium', 'high')"),
        CheckConstraint("confidence >= 0 AND confidence <= 1"),
    )


class AiUsageLog(Base):
    """
    AI Service Usage Tracking
    
    Logs all AI service requests for cost tracking, quota enforcement,
    and analytics. Critical for managing AI costs and usage limits.
    """
    __tablename__ = "ai_usage_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))  # Optional
    
    # Request details
    request_type = Column(String, nullable=False)  # script_analysis, budget_estimation, call_sheet_suggestion, etc.
    endpoint = Column(String)  # API endpoint called
    
    # Cost tracking
    token_count = Column(Integer)  # Tokens consumed
    cost_cents = Column(BIGINT)  # Actual cost in cents
    
    # Performance metrics
    processing_time_ms = Column(Integer)  # Processing time in milliseconds
    
    # Status
    success = Column(Boolean, nullable=False)  # Whether request succeeded
    error_message = Column(Text)  # Error details if failed
    
    # Audit
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        CheckConstraint("request_type IN ('script_analysis', 'budget_estimation', 'call_sheet_suggestion', 'text_analysis', 'other')"),
    )
