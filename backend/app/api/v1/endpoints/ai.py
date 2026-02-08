from typing import Dict, Any, List
from uuid import UUID
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import hashlib
import time

from app.api.deps import (
    get_current_organization,
    get_current_profile,
    get_organization_from_profile,
    require_owner_admin_or_producer,
    require_billing_active,
    get_organization_record,
)
from app.db.session import get_db
from app.services.ai_engine import ai_engine_service
from app.services.notifications import notification_service
from app.services.storage import storage_service
from app.services.entitlements import ensure_ai_credits, increment_ai_usage
from app.modules.ai.service import (
    script_analysis_service,
    ai_suggestion_service,
    ai_recommendation_service,
    ai_usage_log_service
)
from app.models.ai import ScriptAnalysis, AiSuggestion, AiRecommendation
from app.api.v1.endpoints.ai_schemas import (
    ScriptAnalysisRequest,
    BudgetEstimationRequest,
    ShootingDaySuggestionRequest,
    TextAnalysisRequest
)


router = APIRouter()

def infer_suggestion_type(text: str) -> str:
    """
    Best-effort classifier for AiSuggestion.suggestion_type.

    The AI engine currently returns production_notes as plain strings; we map them into
    our limited enum: budget/schedule/casting/logistics/equipment/other.
    """
    t = (text or "").strip().lower()
    if not t:
        return "other"

    # Order matters (more specific first).
    casting_keywords = [
        "cast",
        "casting",
        "actor",
        "actors",
        "talent",
        "extra",
        "extras",
        "stunt",
        "stunts",
        "voiceover",
        "voice over",
        "wardrobe",
        "costume",
        "makeup",
        "hair",
    ]
    schedule_keywords = [
        "schedule",
        "scheduling",
        "call sheet",
        "timeline",
        "availability",
        "overtime",
        "day/night",
        "day-night",
        "weather",
        "sunset",
        "sunrise",
    ]
    logistics_keywords = [
        "permit",
        "permits",
        "clearance",
        "location",
        "transport",
        "travel",
        "parking",
        "catering",
        "security",
        "shipping",
        "customs",
        "visa",
        "insurance",
        "truck",
        "van",
        "refrigerated",
        "cold chain",
        "anvisa",
        "covisa",
        "compliance",
        "regulatory",
    ]
    budget_keywords = [
        "budget",
        "cost",
        "costs",
        "fee",
        "fees",
        "rates",
        "expensive",
        "save",
        "savings",
        "rental",
        "licensing",
        "license",
        "music licensing",
    ]
    equipment_keywords = [
        "camera",
        "lens",
        "lenses",
        "lighting",
        "light",
        "mic",
        "microphone",
        "boom",
        "audio",
        "equipment",
        "gear",
        "drone",
        "fpv",
        "rig",
    ]

    if any(k in t for k in casting_keywords):
        return "casting"
    if any(k in t for k in schedule_keywords):
        return "schedule"
    if any(k in t for k in logistics_keywords):
        return "logistics"
    if any(k in t for k in budget_keywords):
        return "budget"
    if any(k in t for k in equipment_keywords):
        return "equipment"

    # Post-production / legal / general notes end up here.
    return "other"


async def process_script_analysis(
    organization_id: UUID,
    project_id: UUID,
    script_content: str,
    profile_id: UUID,
    db: AsyncSession,
    analysis_type: str = "full"
):
    """
    Background task to process script analysis and send notifications.
    Now saves results to database for persistence.
    """
    start_time = time.time()
    try:
        # Analyze the script with AI
        analysis_result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=script_content,
            project_id=project_id
        )

        # Generate production suggestions
        suggestions = await ai_engine_service.suggest_production_elements(
            organization_id=organization_id,
            script_analysis=analysis_result,
            project_context={"project_id": str(project_id)}
        )

        # Save script analysis to database
        saved_analysis = await script_analysis_service.create_from_ai_result(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            script_text=script_content[:5000],  # Limit stored text
            analysis_result=analysis_result,
            analysis_type=analysis_type,
            confidence=analysis_result.get('confidence', 0.85),
            token_count=len(script_content.split()) * 2,  # Rough estimate
            cost_cents=int(len(script_content.split()) * 0.0005)  # Rough cost estimate
        )

        # Save suggestions to database if any
        if suggestions and isinstance(suggestions, list):
            for suggestion in suggestions[:10]:  # Limit to 10 suggestions
                await ai_suggestion_service.create_from_ai_result(
                    db=db,
                    organization_id=organization_id,
                    project_id=project_id,
                    suggestion_type=suggestion.get('type', 'other'),
                    suggestion_text=suggestion.get('text', ''),
                    confidence=suggestion.get('confidence', 0.75),
                    priority=suggestion.get('priority', 'medium'),
                    related_scenes=suggestion.get('related_scenes', []),
                    estimated_savings_cents=suggestion.get('estimated_savings_cents'),
                    estimated_time_saved_minutes=suggestion.get('estimated_time_saved_minutes')
                )

        # Log successful usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            request_type="script_analysis",
            endpoint="/api/v1/ai/projects/{project_id}/analyze-script",
            token_count=len(script_content.split()) * 2,
            cost_cents=int(len(script_content.split()) * 0.0005),
            processing_time_ms=processing_time_ms,
            success=True
        )

        # Create notification for the user
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile_id,
            title="Script Analysis Complete",
            message=f"AI analysis of your script is ready. Found {len(analysis_result.get('characters', []))} characters and {len(analysis_result.get('scenes', []))} scenes.",
            type="success",
            metadata={
                "analysis_id": str(saved_analysis.id),
                "analysis_result": analysis_result,
                "suggestions": suggestions,
                "project_id": str(project_id)
            }
        )

    except Exception as e:
        # Log failed usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            request_type="script_analysis",
            endpoint="/api/v1/ai/projects/{project_id}/analyze-script",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e)
        )
        
        # Create error notification
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile_id,
            title="Script Analysis Failed",
            message=f"Failed to analyze script: {str(e)}",
            type="error",
            metadata={"error": str(e), "project_id": str(project_id)}
        )


@router.post(
    "/projects/{project_id}/analyze-script",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def analyze_script(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    organization_id: UUID = Depends(get_current_organization),
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Start AI analysis of a project's script.
    This runs in the background and sends a notification when complete.
    """
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Check if project has a script
        # In a real implementation, you'd get the script from storage
        # For now, we'll simulate having script content
        script_content = """
        FADE IN:

        INT. COFFEE SHOP - DAY

        JOHN, 30s, tired businessman, sits at a corner table nursing a coffee. He stares blankly at his laptop screen.

        Suddenly, his phone BUZZES. He checks it - a text from SARAH: "Running late. Be there in 10."

        John sighs, closes his laptop.

        JOHN
        (muttering)
        Story of my life.

        FADE OUT.
        """

        organization = await get_organization_record(profile, db)
        await ensure_ai_credits(db, organization, credits_to_add=1)
        await increment_ai_usage(db, organization.id, credits_added=1)

        # Start background processing
        background_tasks.add_task(
            process_script_analysis,
            organization_id,
            project_id,
            script_content,
            profile.id,
            db
        )

        # Create initial notification
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile.id,
            title="Script Analysis Started",
            message="AI is analyzing your script. You'll receive a notification when it's complete.",
            type="info",
            metadata={"project_id": str(project_id), "status": "processing"}
        )

        return {
            "message": "Script analysis started. Check notifications for results.",
            "project_id": str(project_id),
            "status": "processing"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start script analysis: {str(e)}"
        )


@router.get("/analysis/status/{request_id}", dependencies=[Depends(require_owner_admin_or_producer)])
async def get_analysis_status(
    request_id: str,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get the status of an AI analysis request.
    """
    try:
        status_info = await ai_engine_service.get_processing_status(
            organization_id=organization_id,
            request_id=request_id
        )
        return status_info

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analysis status: {str(e)}"
        )


@router.get("/analysis/", dependencies=[Depends(require_owner_admin_or_producer)])
async def get_ai_analysis(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Get AI analysis results for an organization.
    Returns persisted script analyses from database.
    """
    try:
        # Query script analyses from database
        query = select(ScriptAnalysis).where(
            ScriptAnalysis.organization_id == organization_id
        ).order_by(ScriptAnalysis.created_at.desc()).limit(50)
        
        result = await db.execute(query)
        analyses = result.scalars().all()
        
        # Convert to dict format matching frontend types
        return [
            {
                "id": str(analysis.id),
                "organization_id": str(analysis.organization_id),
                "project_id": str(analysis.project_id),
                "script_text": analysis.script_text,
                "analysis_result": analysis.analysis_result,
                "analysis_type": analysis.analysis_type,
                "confidence": analysis.confidence,
                "created_at": analysis.created_at.isoformat()
            }
            for analysis in analyses
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI analysis: {str(e)}"
        )


@router.delete("/analysis/{analysis_id}", dependencies=[Depends(require_owner_admin_or_producer)])
async def delete_ai_analysis(
    analysis_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Delete a script analysis and (best-effort) delete suggestions and recommendations created for that analysis.

    Notes:
    - Suggestions/recommendations are currently keyed by project_id, not analysis_id.
      We therefore delete rows in the time-slice [analysis.created_at, next_analysis.created_at) for that project.
    """
    query = select(ScriptAnalysis).where(
        ScriptAnalysis.id == analysis_id,
        ScriptAnalysis.organization_id == organization_id,
    )
    result = await db.execute(query)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    # Find the next analysis for this project to bound deletions.
    next_query = (
        select(ScriptAnalysis.created_at)
        .where(
            ScriptAnalysis.organization_id == organization_id,
            ScriptAnalysis.project_id == analysis.project_id,
            ScriptAnalysis.created_at > analysis.created_at,
        )
        .order_by(ScriptAnalysis.created_at.asc())
        .limit(1)
    )
    next_result = await db.execute(next_query)
    next_created_at = next_result.scalar_one_or_none()

    # Delete derived suggestions/recommendations for the analysis time-slice.
    # If this is the latest analysis for the project, bound the deletion window to reduce accidental data loss.
    # Suggestions/recommendations are created immediately after saving the analysis, so 10 minutes is generous.
    if next_created_at is None:
        next_created_at = analysis.created_at + timedelta(minutes=10)

    suggestion_filters = [
        AiSuggestion.organization_id == organization_id,
        AiSuggestion.project_id == analysis.project_id,
        AiSuggestion.created_at >= analysis.created_at,
    ]
    recommendation_filters = [
        AiRecommendation.organization_id == organization_id,
        AiRecommendation.project_id == analysis.project_id,
        AiRecommendation.created_at >= analysis.created_at,
    ]
    suggestion_filters.append(AiSuggestion.created_at < next_created_at)
    recommendation_filters.append(AiRecommendation.created_at < next_created_at)

    deleted_suggestions = await db.execute(delete(AiSuggestion).where(*suggestion_filters))
    deleted_recommendations = await db.execute(delete(AiRecommendation).where(*recommendation_filters))
    await db.execute(delete(ScriptAnalysis).where(ScriptAnalysis.id == analysis_id))

    await db.commit()

    return {
        "message": "Analysis deleted",
        "analysis_id": str(analysis_id),
        "project_id": str(analysis.project_id),
        "deleted_suggestions_count": int(getattr(deleted_suggestions, "rowcount", 0) or 0),
        "deleted_recommendations_count": int(getattr(deleted_recommendations, "rowcount", 0) or 0),
    }


@router.get("/suggestions/{project_id}", dependencies=[Depends(require_owner_admin_or_producer)])
async def get_ai_suggestions(
    project_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Get AI suggestions for a specific project.
    Returns persisted suggestions from database.
    """
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Query suggestions from database
        query = select(AiSuggestion).where(
            AiSuggestion.project_id == project_id
        ).order_by(AiSuggestion.created_at.desc())
        
        result = await db.execute(query)
        suggestions = result.scalars().all()
        
        # Convert to dict format matching frontend types
        return [
            {
                "id": str(suggestion.id),
                "organization_id": str(suggestion.organization_id),
                "project_id": str(suggestion.project_id),
                "suggestion_type": suggestion.suggestion_type,
                "suggestion_text": suggestion.suggestion_text,
                "confidence": suggestion.confidence,
                "priority": suggestion.priority,
                "related_scenes": suggestion.related_scenes or [],
                "estimated_savings_cents": suggestion.estimated_savings_cents,
                "estimated_time_saved_minutes": suggestion.estimated_time_saved_minutes,
                "created_at": suggestion.created_at.isoformat()
            }
            for suggestion in suggestions
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI suggestions: {str(e)}"
        )


@router.get("/recommendations/{project_id}", dependencies=[Depends(require_owner_admin_or_producer)])
async def get_ai_recommendations(
    project_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Get AI recommendations for a specific project.
    Returns persisted recommendations from database.
    """
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        # Query recommendations from database
        query = select(AiRecommendation).where(
            AiRecommendation.project_id == project_id
        ).order_by(AiRecommendation.created_at.desc())
        
        result = await db.execute(query)
        recommendations = result.scalars().all()
        
        # Convert to dict format matching frontend types
        return [
            {
                "id": str(recommendation.id),
                "organization_id": str(recommendation.organization_id),
                "project_id": str(recommendation.project_id),
                "recommendation_type": recommendation.recommendation_type,
                "title": recommendation.title,
                "description": recommendation.description,
                "confidence": recommendation.confidence,
                "priority": recommendation.priority,
                "action_items": recommendation.action_items or [],
                "estimated_impact": recommendation.estimated_impact or {},
                "created_at": recommendation.created_at.isoformat()
            }
            for recommendation in recommendations
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI recommendations: {str(e)}"
        )


@router.post("/budget-estimation", dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)])
async def estimate_budget(
    request: BudgetEstimationRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Generate AI-powered budget estimation for a project.
    """
    start_time = time.time()
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=request.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        organization = await get_organization_record(profile, db)
        await ensure_ai_credits(db, organization, credits_to_add=1)
        await increment_ai_usage(db, organization.id, credits_added=1)

        # Generate real budget estimation
        result = await ai_engine_service.estimate_project_budget(
            organization_id=organization_id,
            script_content=request.script_content,
            estimation_type=request.estimation_type,
            project_context={"project_id": str(request.project_id)}
        )

        # ai_engine_service returns {"error": "..."} on failures/timeouts.
        if isinstance(result, dict) and result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(result["error"]),
            )
        
        # Log successful usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="budget_estimation",
            endpoint="/api/v1/ai/budget-estimation",
            token_count=len(request.script_content.split()) * 2,
            cost_cents=int(len(request.script_content.split()) * 0.0005),
            processing_time_ms=processing_time_ms,
            success=True
        )

        # Merge with base response
        return {
            "message": "Budget estimation generated successfully",
            "project_id": str(request.project_id),
            "estimation_type": request.estimation_type,
            "estimated_budget_cents": result.get("estimated_budget_cents", 0),
            "breakdown": result.get("breakdown", []),
            "risk_factors": result.get("risk_factors", []),
            "recommendations": result.get("recommendations", [])
        }

    except HTTPException as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="budget_estimation",
            endpoint="/api/v1/ai/budget-estimation",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e.detail),
        )
        raise

    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="budget_estimation",
            endpoint="/api/v1/ai/budget-estimation",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to estimate budget: {str(e)}"
        )


@router.post("/shooting-day-suggestions", dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)])
async def generate_shooting_day_suggestions(
    request: ShootingDaySuggestionRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Generate AI-powered shooting day suggestions for a project.
    """
    start_time = time.time()
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=request.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )

        organization = await get_organization_record(profile, db)
        await ensure_ai_credits(db, organization, credits_to_add=1)
        await increment_ai_usage(db, organization.id, credits_added=1)

        # Generate real call sheet suggestions
        
        # Determine source data for suggestions
        analysis_data = {}
        
        # 1. If script content is provided in request, analyze it on the fly
        if request.script_content and len(request.script_content.strip()) > 0:
            analysis_result = await ai_engine_service.analyze_script_content(
                organization_id=organization_id,
                script_content=request.script_content,
                project_id=request.project_id
            )
            if isinstance(analysis_result, dict) and analysis_result.get("error"):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=str(analysis_result["error"]),
                )
            analysis_data = analysis_result
        else:
            # 2. Fallback: look for existing analysis in DB
            query = select(ScriptAnalysis).where(
                ScriptAnalysis.project_id == request.project_id
            ).order_by(ScriptAnalysis.created_at.desc()).limit(1)
            result = await db.execute(query)
            latest_analysis = result.scalar_one_or_none()
            
            if latest_analysis and latest_analysis.analysis_result:
                analysis_data = latest_analysis.analysis_result

        if not analysis_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No script analysis available. Provide script_content or run script analysis first.",
            )

        # Generate suggestions based on the analysis data (new or existing)
        suggestions = await ai_engine_service.suggest_production_elements(
            organization_id=organization_id,
            script_analysis=analysis_data,
            project_context={"project_id": str(request.project_id)}
        )
        if isinstance(suggestions, dict) and suggestions.get("error"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(suggestions["error"]),
            )

        call_sheet_data = suggestions.get("call_sheet_suggestions", [])

        # Log successful usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="shooting_day_suggestion",
            endpoint="/api/v1/ai/shooting-day-suggestions",
            token_count=len(request.script_content.split()) * 4,  # analysis + suggestions (rough)
            cost_cents=int(len(request.script_content.split()) * 0.001),  # rough
            processing_time_ms=processing_time_ms,
            success=True,
        )
        
        return {
            "message": "Shooting day suggestions generated",
            "project_id": str(request.project_id),
            "suggestion_type": request.suggestion_type,
            "suggestions": call_sheet_data,
            # Flatten the first suggestion details for immediate display if needed
            "day": call_sheet_data[0].get("day") if call_sheet_data else 1,
            "suggested_scenes": call_sheet_data[0].get("suggested_scenes") if call_sheet_data else [],
            "crew_needed": call_sheet_data[0].get("crew_needed") if call_sheet_data else [],
            "equipment_needed": call_sheet_data[0].get("equipment_needed") if call_sheet_data else [],
            "estimated_duration": call_sheet_data[0].get("estimated_duration") if call_sheet_data else "N/A"
        }

    except HTTPException as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="shooting_day_suggestion",
            endpoint="/api/v1/ai/shooting-day-suggestions",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e.detail),
        )
        raise

    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="shooting_day_suggestion",
            endpoint="/api/v1/ai/shooting-day-suggestions",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate call sheet suggestions: {str(e)}"
        )


@router.post("/script-analysis", dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)])
async def analyze_script_content(
    request: ScriptAnalysisRequest,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Analyze script content and extract production elements.
    Now saves results to database for persistence.
    """
    start_time = time.time()
    try:
        # Validate project ownership
        from app.modules.commercial.service import project_service

        project = await project_service.get(db=db, organization_id=organization_id, id=request.project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        clean_content = (request.script_content or "").strip()
        if not clean_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Script content is empty",
            )

        # Deduplicate identical analyses to avoid duplicated suggestions/recommendations.
        if len(clean_content) > 50000:
            clean_content = clean_content[:50000]
        content_hash = hashlib.sha256(clean_content.encode()).hexdigest()
        if not request.force_new:
            duplicate_query = (
                select(ScriptAnalysis)
                .where(
                    ScriptAnalysis.organization_id == organization_id,
                    ScriptAnalysis.project_id == request.project_id,
                    ScriptAnalysis.analysis_type == request.analysis_type,
                    ScriptAnalysis.analysis_result["metadata"]["content_hash"].as_string() == content_hash,
                )
                .order_by(ScriptAnalysis.created_at.desc())
                .limit(1)
            )
            duplicate_result = await db.execute(duplicate_query)
            duplicate_analysis = duplicate_result.scalar_one_or_none()
            if duplicate_analysis:
                return {
                    "message": "Script analysis already exists for this content",
                    "project_id": str(request.project_id),
                    "analysis_type": request.analysis_type,
                    "result": duplicate_analysis.analysis_result,
                    "analysis_id": str(duplicate_analysis.id),
                    "deduplicated": True,
                }

        organization = await get_organization_record(profile, db)
        await ensure_ai_credits(db, organization, credits_to_add=1)
        await increment_ai_usage(db, organization.id, credits_added=1)

        # Analyze the script with AI
        analysis_result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=request.script_content,
            project_id=request.project_id,
            analysis_type=request.analysis_type,
        )

        # ai_engine_service returns a structured dict with "error" on failures/timeouts.
        if isinstance(analysis_result, dict) and analysis_result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(analysis_result["error"]),
            )

        # Save script analysis to database
        saved_analysis = await script_analysis_service.create_from_ai_result(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            script_text=request.script_content[:5000],  # Limit stored text
            analysis_result=analysis_result,
            analysis_type=request.analysis_type,
            confidence=analysis_result.get("confidence", 0.85),
            token_count=len(request.script_content.split()) * 2,  # Rough estimate
            cost_cents=int(len(request.script_content.split()) * 0.0005),  # Rough cost estimate
        )

        # Extract and save suggestions if present in the analysis
        suggestions_data = analysis_result.get("production_notes", [])
        if suggestions_data and isinstance(suggestions_data, list):
            seen_notes: set[str] = set()
            for suggestion_text in suggestions_data[:10]:  # Limit to 10
                if isinstance(suggestion_text, str):
                    clean_note = suggestion_text.strip()
                    if not clean_note:
                        continue
                    note_key = clean_note.lower()
                    if note_key in seen_notes:
                        continue
                    seen_notes.add(note_key)
                    await ai_suggestion_service.create_from_ai_result(
                        db=db,
                        organization_id=organization_id,
                        project_id=request.project_id,
                        suggestion_type=infer_suggestion_type(clean_note),
                        suggestion_text=clean_note,
                        confidence=0.75,
                        priority="medium",
                        related_scenes=[],
                    )

        # Create recommendations from analysis results
        # Equipment recommendations
        equipment_data = analysis_result.get("suggested_equipment", [])
        equipment_list: list[str] = []
        if equipment_data and isinstance(equipment_data, list) and len(equipment_data) > 0:
            raw_items: list[str] = []
            for eq in equipment_data:
                if isinstance(eq, dict):
                    # Current AI engine prompt uses {"category": "...", "items": [...], "reasoning": "..."}
                    items = eq.get("items")
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, str):
                                raw_items.append(item)
                    else:
                        item = eq.get("item")
                        if isinstance(item, str):
                            raw_items.append(item)
                elif isinstance(eq, str):
                    raw_items.append(eq)

            seen_items: set[str] = set()
            for item in raw_items:
                clean_item = item.strip()
                if not clean_item:
                    continue
                item_key = clean_item.lower()
                if item_key in seen_items:
                    continue
                seen_items.add(item_key)
                equipment_list.append(clean_item)
                if len(equipment_list) >= 10:
                    break

        if equipment_list:
            await ai_recommendation_service.create_from_ai_result(
                db=db,
                organization_id=organization_id,
                project_id=request.project_id,
                recommendation_type="equipment",
                title="Equipment Recommendations",
                description=f'Based on script analysis, the following equipment is recommended: {", ".join(equipment_list)}',
                confidence=0.80,
                priority="high",
                action_items=equipment_list,
            )

        # Schedule recommendations based on scenes
        scenes_data = analysis_result.get("scenes", [])
        if scenes_data and isinstance(scenes_data, list) and len(scenes_data) > 0:
            scene_count = len(scenes_data)
            locations = set()
            locations_data = analysis_result.get("locations", [])
            if isinstance(locations_data, list):
                for loc in locations_data:
                    if isinstance(loc, dict):
                        name = loc.get("name")
                        if isinstance(name, str) and name.strip():
                            locations.add(name.strip())
                    elif isinstance(loc, str) and loc.strip():
                        locations.add(loc.strip())

            action_items = [
                f"Plan for {scene_count} scenes",
                f"Coordinate {len(locations)} unique locations" if locations else "Coordinate locations and permits",
                "Schedule location permits",
                "Plan crew and talent availability",
            ]

            await ai_recommendation_service.create_from_ai_result(
                db=db,
                organization_id=organization_id,
                project_id=request.project_id,
                recommendation_type="schedule",
                title="Production Schedule Recommendations",
                description=f"Your script contains {scene_count} scenes across {len(locations)} locations. Proper scheduling will be critical for efficiency.",
                confidence=0.85,
                priority="high",
                action_items=action_items,
            )

        # Log successful usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="script_analysis",
            endpoint="/api/v1/ai/script-analysis",
            token_count=len(request.script_content.split()) * 2,
            cost_cents=int(len(request.script_content.split()) * 0.0005),
            processing_time_ms=processing_time_ms,
            success=True,
        )

        return {
            "message": "Script analysis completed",
            "project_id": str(request.project_id),
            "analysis_type": request.analysis_type,
            "result": analysis_result,
            "analysis_id": str(saved_analysis.id),
        }

    except HTTPException as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="script_analysis",
            endpoint="/api/v1/ai/script-analysis",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e.detail),
        )
        raise

    except Exception as e:
        # Log failed usage
        processing_time_ms = int((time.time() - start_time) * 1000)
        await ai_usage_log_service.log_request(
            db=db,
            organization_id=organization_id,
            project_id=request.project_id,
            request_type="script_analysis",
            endpoint="/api/v1/ai/script-analysis",
            processing_time_ms=processing_time_ms,
            success=False,
            error_message=str(e),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Script analysis failed: {str(e)}",
        )


@router.post("/analyze-text", dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)])
async def analyze_text_content(
    request: TextAnalysisRequest,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Analyze arbitrary text content with AI.
    This is a synchronous endpoint for quick analysis.
    """
    try:
        # For small text analysis, do it synchronously
        if len(request.text) > 10000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text too long for synchronous analysis. Use project script analysis instead."
            )

        organization = await get_organization_record(profile, db)
        await ensure_ai_credits(db, organization, credits_to_add=1)
        await increment_ai_usage(db, organization.id, credits_added=1)

        result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=request.text
        )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text analysis failed: {str(e)}"
        )
