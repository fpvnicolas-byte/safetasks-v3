"""
AI Service Layer

Provides CRUD operations and business logic for AI features including
script analysis, suggestions, recommendations, and usage tracking.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, Integer
from app.services.base import BaseService
from app.models.ai import ScriptAnalysis, AiSuggestion, AiRecommendation, AiUsageLog
from uuid import UUID
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


class ScriptAnalysisService(BaseService[ScriptAnalysis, Any, Any]):
    """Service for ScriptAnalysis operations."""

    def __init__(self):
        super().__init__(ScriptAnalysis)

    async def create_from_ai_result(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        script_text: str,
        analysis_result: Dict[str, Any],
        analysis_type: str,
        confidence: float,
        token_count: Optional[int] = None,
        cost_cents: Optional[int] = None
    ) -> ScriptAnalysis:
        """Create a new script analysis from AI results."""
        analysis = ScriptAnalysis(
            organization_id=organization_id,
            project_id=project_id,
            script_text=script_text,
            analysis_result=analysis_result,
            analysis_type=analysis_type,
            confidence=confidence,
            token_count=token_count,
            cost_cents=cost_cents
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        return analysis


class AiSuggestionService(BaseService[AiSuggestion, Any, Any]):
    """Service for AiSuggestion operations."""

    def __init__(self):
        super().__init__(AiSuggestion)

    async def create_from_ai_result(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        suggestion_type: str,
        suggestion_text: str,
        confidence: float,
        priority: str,
        related_scenes: Optional[List[int]] = None,
        estimated_savings_cents: Optional[int] = None,
        estimated_time_saved_minutes: Optional[int] = None
    ) -> AiSuggestion:
        """Create a new AI suggestion."""
        suggestion = AiSuggestion(
            organization_id=organization_id,
            project_id=project_id,
            suggestion_type=suggestion_type,
            suggestion_text=suggestion_text,
            confidence=confidence,
            priority=priority,
            related_scenes=related_scenes or [],
            estimated_savings_cents=estimated_savings_cents,
            estimated_time_saved_minutes=estimated_time_saved_minutes
        )
        db.add(suggestion)
        await db.commit()
        await db.refresh(suggestion)
        return suggestion


class AiRecommendationService(BaseService[AiRecommendation, Any, Any]):
    """Service for AiRecommendation operations."""

    def __init__(self):
        super().__init__(AiRecommendation)

    async def create_from_ai_result(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        recommendation_type: str,
        title: str,
        description: str,
        confidence: float,
        priority: str,
        action_items: List[str],
        estimated_impact: Optional[Dict[str, Any]] = None
    ) -> AiRecommendation:
        """Create a new AI recommendation."""
        recommendation = AiRecommendation(
            organization_id=organization_id,
            project_id=project_id,
            recommendation_type=recommendation_type,
            title=title,
            description=description,
            confidence=confidence,
            priority=priority,
            action_items=action_items,
            estimated_impact=estimated_impact or {}
        )
        db.add(recommendation)
        await db.commit()
        await db.refresh(recommendation)
        return recommendation


class AiUsageLogService(BaseService[AiUsageLog, Any, Any]):
    """Service for AiUsageLog operations with analytics."""

    def __init__(self):
        super().__init__(AiUsageLog)

    async def log_request(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        request_type: str,
        success: bool,
        project_id: Optional[UUID] = None,
        endpoint: Optional[str] = None,
        token_count: Optional[int] = None,
        cost_cents: Optional[int] = None,
        processing_time_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> AiUsageLog:
        """Log an AI service request."""
        log_entry = AiUsageLog(
            organization_id=organization_id,
            project_id=project_id,
            request_type=request_type,
            endpoint=endpoint,
            token_count=token_count,
            cost_cents=cost_cents,
            processing_time_ms=processing_time_ms,
            success=success,
            error_message=error_message
        )
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)
        return log_entry

    async def get_success_rate(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        days: int = 30
    ) -> float:
        """Calculate AI service success rate for an organization."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Count total and successful requests
        query = select(
            func.count(AiUsageLog.id).label('total'),
            func.sum(func.cast(AiUsageLog.success, Integer)).label('successful')
        ).where(
            and_(
                AiUsageLog.organization_id == organization_id,
                AiUsageLog.timestamp >= cutoff_date
            )
        )
        
        result = await db.execute(query)
        row = result.first()
        
        if not row or row.total == 0:
            return 0.0
        
        return (row.successful / row.total) * 100

    async def get_usage_stats(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive usage statistics for an organization."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = select(
            func.count(AiUsageLog.id).label('total_requests'),
            func.sum(func.cast(AiUsageLog.success, Integer)).label('successful_requests'),
            func.sum(AiUsageLog.token_count).label('total_tokens'),
            func.sum(AiUsageLog.cost_cents).label('total_cost_cents'),
            func.avg(AiUsageLog.processing_time_ms).label('avg_processing_time_ms')
        ).where(
            and_(
                AiUsageLog.organization_id == organization_id,
                AiUsageLog.timestamp >= cutoff_date
            )
        )
        
        result = await db.execute(query)
        row = result.first()
        
        if not row or row.total_requests == 0:
            return {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'success_rate': 0.0,
                'total_tokens': 0,
                'total_cost_cents': 0,
                'avg_processing_time_ms': 0
            }
        
        return {
            'total_requests': row.total_requests,
            'successful_requests': row.successful_requests or 0,
            'failed_requests': row.total_requests - (row.successful_requests or 0),
            'success_rate': ((row.successful_requests or 0) / row.total_requests) * 100,
            'total_tokens': row.total_tokens or 0,
            'total_cost_cents': row.total_cost_cents or 0,
            'avg_processing_time_ms': row.avg_processing_time_ms or 0
        }


# Service instances
script_analysis_service = ScriptAnalysisService()
ai_suggestion_service = AiSuggestionService()
ai_recommendation_service = AiRecommendationService()
ai_usage_log_service = AiUsageLogService()
