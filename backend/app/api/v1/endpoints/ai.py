from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import hashlib
import time
import json
import unicodedata

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
from app.services.entitlements import ensure_and_reserve_ai_credits
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


def _map_ai_error_to_http(error_message: str) -> tuple[int, str]:
    """Map provider/internal AI failures to user-facing HTTP responses."""
    message = (error_message or "").strip() or "AI request failed"
    lowered = message.lower()

    if any(tag in lowered for tag in ("resource exhausted", "429", "too many requests", "rate limit")):
        return status.HTTP_429_TOO_MANY_REQUESTS, message
    if any(tag in lowered for tag in ("timed out", "timeout", "deadline exceeded")):
        return status.HTTP_504_GATEWAY_TIMEOUT, message
    if "service unavailable" in lowered:
        return status.HTTP_503_SERVICE_UNAVAILABLE, message

    return status.HTTP_503_SERVICE_UNAVAILABLE, message


def _raise_for_ai_error(error_message: str) -> None:
    http_status, detail = _map_ai_error_to_http(error_message)
    raise HTTPException(status_code=http_status, detail=detail)


def _resolve_response_language(
    *,
    script_content: Optional[str] = None,
    analysis_result: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Resolve response language for downstream AI or server-generated text.
    Priority:
    1) analysis metadata.response_language
    2) language detected from script content
    3) language detected from analysis payload text
    4) English fallback
    """
    if isinstance(analysis_result, dict):
        metadata = analysis_result.get("metadata")
        if isinstance(metadata, dict):
            metadata_language = metadata.get("response_language")
            if isinstance(metadata_language, str) and metadata_language.strip():
                normalized = metadata_language.strip().lower()
                if normalized.startswith("pt"):
                    return "pt-BR"
                if normalized.startswith("en"):
                    return "en"

    if script_content and script_content.strip():
        return ai_engine_service.detect_content_language(script_content)

    if isinstance(analysis_result, dict):
        payload_text = json.dumps(analysis_result, ensure_ascii=False)
        if payload_text.strip():
            return ai_engine_service.detect_content_language(payload_text)

    return "en"


def _is_pt_br(language: str) -> bool:
    return (language or "").lower().startswith("pt")


def _localized_text(language: str, *, pt_br: str, en: str) -> str:
    return pt_br if _is_pt_br(language) else en


def _equipment_recommendation_copy(language: str, equipment_list: List[str]) -> tuple[str, str]:
    if _is_pt_br(language):
        return (
            "Recomendações de Equipamentos",
            f"Com base na análise do roteiro, os seguintes equipamentos são recomendados: {', '.join(equipment_list)}",
        )
    return (
        "Equipment Recommendations",
        f"Based on script analysis, the following equipment is recommended: {', '.join(equipment_list)}",
    )


def _schedule_recommendation_copy(
    language: str,
    scene_count: int,
    location_count: int,
) -> tuple[str, str, List[str]]:
    if _is_pt_br(language):
        action_items = [
            f"Planejar {scene_count} cenas",
            f"Coordenar {location_count} locações únicas" if location_count else "Coordenar locações e autorizações",
            "Agendar autorizações de locação",
            "Planejar disponibilidade de equipe e elenco",
        ]
        description = (
            f"Seu roteiro contém {scene_count} cenas em {location_count} locações. "
            "Um bom planejamento de cronograma será essencial para eficiência."
        )
        return ("Recomendações de Cronograma de Produção", description, action_items)

    action_items = [
        f"Plan for {scene_count} scenes",
        f"Coordinate {location_count} unique locations" if location_count else "Coordinate locations and permits",
        "Schedule location permits",
        "Plan crew and talent availability",
    ]
    description = (
        f"Your script contains {scene_count} scenes across {location_count} locations. "
        "Proper scheduling will be critical for efficiency."
    )
    return ("Production Schedule Recommendations", description, action_items)


def _normalize_hint_text(text: str) -> str:
    """Normalize free-form suggestion text for keyword matching."""
    lowered = (text or "").strip().lower()
    if not lowered:
        return ""
    return unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode("ascii")


def infer_suggestion_type(text: str) -> str:
    """
    Best-effort classifier for AiSuggestion.suggestion_type.

    The AI engine currently returns production_notes as plain strings; we map them into
    our limited enum: budget/schedule/casting/logistics/equipment/other.
    """
    t = _normalize_hint_text(text)
    if not t:
        return "other"

    # Order matters (more specific first).
    casting_keywords = [
        "cast",
        "casting",
        "actor",
        "actors",
        "atriz",
        "ator",
        "atores",
        "atrizes",
        "elenco",
        "talent",
        "extra",
        "extras",
        "figurante",
        "figurantes",
        "stunt",
        "stunts",
        "duble",
        "dubles",
        "voiceover",
        "voice over",
        "dublagem",
        "voz",
        "wardrobe",
        "figurino",
        "costume",
        "fantasia",
        "makeup",
        "maquiagem",
        "hair",
        "cabelo",
    ]
    schedule_keywords = [
        "schedule",
        "scheduling",
        "cronograma",
        "agenda",
        "shooting day",
        "dia de filmagem",
        "timeline",
        "prazo",
        "atraso",
        "availability",
        "disponibilidade",
        "overtime",
        "hora extra",
        "day/night",
        "day-night",
        "weather",
        "clima",
        "chuva",
        "tempestade",
        "sunset",
        "por do sol",
        "sunrise",
        "nascer do sol",
    ]
    logistics_keywords = [
        "permit",
        "permits",
        "autorizacao",
        "autorizacoes",
        "permissao",
        "permissoes",
        "clearance",
        "location",
        "locacao",
        "locacoes",
        "cenario",
        "cenarios",
        "transport",
        "transporte",
        "travel",
        "viagem",
        "parking",
        "estacionamento",
        "catering",
        "alimentacao",
        "security",
        "seguranca",
        "shipping",
        "customs",
        "visa",
        "insurance",
        "seguro",
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
        "orcamento",
        "cost",
        "costs",
        "custo",
        "custos",
        "fee",
        "fees",
        "taxa",
        "taxas",
        "rates",
        "diaria",
        "diarias",
        "expensive",
        "caro",
        "caros",
        "save",
        "savings",
        "economia",
        "economizar",
        "rental",
        "aluguel",
        "licensing",
        "license",
        "licenca",
        "licencas",
        "music licensing",
    ]
    post_production_keywords = [
        "vfx",
        "visual effects",
        "efeitos visuais",
        "post-production",
        "pos-producao",
        "pos producao",
        "finalizacao",
        "render",
        "cgi",
        "compositing",
        "composicao",
        "motion graphics",
        "grafismo",
        "color grading",
        "correcao de cor",
        "contraste",
        "ui",
        "interface",
    ]
    equipment_keywords = [
        "camera",
        "camara",
        "lens",
        "lenses",
        "lente",
        "lentes",
        "lighting",
        "iluminacao",
        "light",
        "luz",
        "mic",
        "microphone",
        "microfone",
        "boom",
        "audio",
        "som",
        "equipment",
        "equipamento",
        "equipamentos",
        "gear",
        "drone",
        "fpv",
        "rig",
        "gimbal",
        "tripod",
        "tripe",
    ]

    if any(k in t for k in casting_keywords):
        return "casting"
    if any(k in t for k in schedule_keywords):
        return "schedule"
    if any(k in t for k in logistics_keywords):
        return "logistics"
    if any(k in t for k in budget_keywords):
        return "budget"
    if any(k in t for k in post_production_keywords):
        return "other"
    if any(k in t for k in equipment_keywords):
        return "equipment"

    # Post-production / legal / general notes end up here.
    return "other"


def is_post_production_note(text: str) -> bool:
    t = _normalize_hint_text(text)
    if not t:
        return False

    post_production_keywords = [
        "vfx",
        "visual effects",
        "efeitos visuais",
        "post-production",
        "pos-producao",
        "pos producao",
        "finalizacao",
        "render",
        "cgi",
        "compositing",
        "composicao",
        "motion graphics",
        "grafismo",
        "color grading",
        "correcao de cor",
        "contraste",
        "ui",
        "interface",
    ]
    return any(k in t for k in post_production_keywords)


def infer_suggestion_priority_confidence(text: str, suggestion_type: str) -> tuple[str, float]:
    """
    Best-effort priority and confidence inference for plain production notes.
    """
    t = _normalize_hint_text(text)
    if not t:
        return "medium", 0.75

    high_priority_keywords = [
        "seguranca",
        "safety",
        "risco",
        "risk",
        "urgente",
        "urgent",
        "critico",
        "critical",
        "chuva",
        "tempestade",
        "weather",
        "permit",
        "autorizacao",
        "compliance",
        "regulatory",
        "seguro",
        "insurance",
    ]
    low_priority_keywords = [
        "opcional",
        "optional",
        "nice to have",
        "ui",
        "interface",
        "estetica",
        "aesthetic",
        "contraste",
        "post",
        "pos",
        "post-production",
    ]

    if any(k in t for k in high_priority_keywords):
        return "high", 0.86 if suggestion_type != "other" else 0.8

    if any(k in t for k in low_priority_keywords):
        return "low", 0.68 if suggestion_type != "other" else 0.62

    if suggestion_type == "other":
        return "medium", 0.7
    return "medium", 0.78


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
        if isinstance(analysis_result, dict) and analysis_result.get("error"):
            _raise_for_ai_error(str(analysis_result["error"]))
        response_language = _resolve_response_language(
            script_content=script_content,
            analysis_result=analysis_result,
        )

        # Generate production suggestions
        suggestions = await ai_engine_service.suggest_production_elements(
            organization_id=organization_id,
            script_analysis=analysis_result,
            project_context={"project_id": str(project_id)},
            response_language=response_language,
        )
        if isinstance(suggestions, dict) and suggestions.get("error"):
            _raise_for_ai_error(str(suggestions["error"]))

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
            title=_localized_text(
                response_language,
                pt_br="Análise de Roteiro Concluída",
                en="Script Analysis Complete",
            ),
            message=_localized_text(
                response_language,
                pt_br=(
                    f"A análise de IA do seu roteiro está pronta. "
                    f"Foram encontrados {len(analysis_result.get('characters', []))} personagens e {len(analysis_result.get('scenes', []))} cenas."
                ),
                en=(
                    f"AI analysis of your script is ready. Found {len(analysis_result.get('characters', []))} "
                    f"characters and {len(analysis_result.get('scenes', []))} scenes."
                ),
            ),
            type="success",
            metadata={
                "analysis_id": str(saved_analysis.id),
                "analysis_result": analysis_result,
                "suggestions": suggestions,
                "project_id": str(project_id)
            }
        )

    except Exception as e:
        response_language = ai_engine_service.detect_content_language(script_content or "")

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
            title=_localized_text(
                response_language,
                pt_br="Falha na Análise de Roteiro",
                en="Script Analysis Failed",
            ),
            message=_localized_text(
                response_language,
                pt_br=f"Falha ao analisar o roteiro: {str(e)}",
                en=f"Failed to analyze script: {str(e)}",
            ),
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
        await ensure_and_reserve_ai_credits(db, organization, credits_to_add=1)

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
        response_language = ai_engine_service.detect_content_language(script_content)
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile.id,
            title=_localized_text(
                response_language,
                pt_br="Análise de Roteiro Iniciada",
                en="Script Analysis Started",
            ),
            message=_localized_text(
                response_language,
                pt_br="A IA está analisando seu roteiro. Você receberá uma notificação quando terminar.",
                en="AI is analyzing your script. You'll receive a notification when it's complete.",
            ),
            type="info",
            metadata={"project_id": str(project_id), "status": "processing"}
        )

        return {
            "message": _localized_text(
                response_language,
                pt_br="Análise de roteiro iniciada. Verifique as notificações para os resultados.",
                en="Script analysis started. Check notifications for results.",
            ),
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
            AiSuggestion.project_id == project_id,
            AiSuggestion.organization_id == organization_id,
        ).order_by(AiSuggestion.created_at.desc())
        
        result = await db.execute(query)
        suggestions = result.scalars().all()
        
        # Convert to dict format matching frontend types.
        # Legacy suggestions were often saved as other/medium/0.75; enrich response values on read.
        response_suggestions: List[Dict[str, Any]] = []
        for suggestion in suggestions:
            suggestion_type = suggestion.suggestion_type
            priority = suggestion.priority
            confidence = suggestion.confidence

            inferred_type = infer_suggestion_type(suggestion.suggestion_text or "")
            if suggestion_type == "other" and inferred_type != "other":
                suggestion_type = inferred_type
            elif suggestion_type == "equipment" and is_post_production_note(suggestion.suggestion_text or ""):
                suggestion_type = "other"

            is_legacy_default = priority == "medium" and abs((confidence or 0.0) - 0.75) < 1e-9
            if is_legacy_default:
                priority, confidence = infer_suggestion_priority_confidence(
                    suggestion.suggestion_text or "",
                    suggestion_type,
                )

            response_suggestions.append(
                {
                    "id": str(suggestion.id),
                    "organization_id": str(suggestion.organization_id),
                    "project_id": str(suggestion.project_id),
                    "suggestion_type": suggestion_type,
                    "suggestion_text": suggestion.suggestion_text,
                    "confidence": confidence,
                    "priority": priority,
                    "related_scenes": suggestion.related_scenes or [],
                    "estimated_savings_cents": suggestion.estimated_savings_cents,
                    "estimated_time_saved_minutes": suggestion.estimated_time_saved_minutes,
                    "created_at": suggestion.created_at.isoformat()
                }
            )

        return response_suggestions
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
        await ensure_and_reserve_ai_credits(db, organization, credits_to_add=1)

        # Generate real budget estimation
        result = await ai_engine_service.estimate_project_budget(
            organization_id=organization_id,
            script_content=request.script_content,
            estimation_type=request.estimation_type,
            project_context={"project_id": str(request.project_id)}
        )

        # ai_engine_service returns {"error": "..."} on failures/timeouts.
        if isinstance(result, dict) and result.get("error"):
            _raise_for_ai_error(str(result["error"]))
        response_language = _resolve_response_language(
            script_content=request.script_content,
            analysis_result=result,
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
            "message": _localized_text(
                response_language,
                pt_br="Estimativa de orçamento gerada com sucesso",
                en="Budget estimation generated successfully",
            ),
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
        await ensure_and_reserve_ai_credits(db, organization, credits_to_add=1)

        # Generate real shooting day suggestions
        
        # Determine source data for suggestions
        analysis_data = {}
        response_language = "en"
        
        # 1. If script content is provided in request, analyze it on the fly
        if request.script_content and len(request.script_content.strip()) > 0:
            analysis_result = await ai_engine_service.analyze_script_content(
                organization_id=organization_id,
                script_content=request.script_content,
                project_id=request.project_id
            )
            if isinstance(analysis_result, dict) and analysis_result.get("error"):
                _raise_for_ai_error(str(analysis_result["error"]))
            analysis_data = analysis_result
            response_language = _resolve_response_language(
                script_content=request.script_content,
                analysis_result=analysis_result,
            )
        else:
            # 2. Fallback: look for existing analysis in DB
            query = select(ScriptAnalysis).where(
                ScriptAnalysis.project_id == request.project_id
            ).order_by(ScriptAnalysis.created_at.desc()).limit(1)
            result = await db.execute(query)
            latest_analysis = result.scalar_one_or_none()
            
            if latest_analysis and latest_analysis.analysis_result:
                analysis_data = latest_analysis.analysis_result
                response_language = _resolve_response_language(
                    analysis_result=analysis_data,
                )

        if not analysis_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No script analysis available. Provide script_content or run script analysis first.",
            )

        # Generate suggestions based on the analysis data (new or existing)
        suggestions = await ai_engine_service.suggest_production_elements(
            organization_id=organization_id,
            script_analysis=analysis_data,
            project_context={"project_id": str(request.project_id)},
            response_language=response_language,
        )
        if isinstance(suggestions, dict) and suggestions.get("error"):
            _raise_for_ai_error(str(suggestions["error"]))

        shooting_day_data = suggestions.get("shooting_day_suggestions", [])

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
            "message": _localized_text(
                response_language,
                pt_br="Sugestões de dia de filmagem geradas",
                en="Shooting day suggestions generated",
            ),
            "project_id": str(request.project_id),
            "suggestion_type": request.suggestion_type,
            "suggestions": shooting_day_data,
            # Flatten the first suggestion details for immediate display if needed
            "day": shooting_day_data[0].get("day") if shooting_day_data else 1,
            "suggested_scenes": shooting_day_data[0].get("suggested_scenes") if shooting_day_data else [],
            "crew_needed": shooting_day_data[0].get("crew_needed") if shooting_day_data else [],
            "equipment_needed": shooting_day_data[0].get("equipment_needed") if shooting_day_data else [],
            "estimated_duration": shooting_day_data[0].get("estimated_duration") if shooting_day_data else "N/A"
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
            detail=f"Failed to generate shooting day suggestions: {str(e)}"
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
                duplicate_language = _resolve_response_language(
                    script_content=request.script_content,
                    analysis_result=duplicate_analysis.analysis_result,
                )
                return {
                    "message": _localized_text(
                        duplicate_language,
                        pt_br="A análise deste conteúdo já existe",
                        en="Script analysis already exists for this content",
                    ),
                    "project_id": str(request.project_id),
                    "analysis_type": request.analysis_type,
                    "result": duplicate_analysis.analysis_result,
                    "analysis_id": str(duplicate_analysis.id),
                    "deduplicated": True,
                }

        organization = await get_organization_record(profile, db)
        await ensure_and_reserve_ai_credits(db, organization, credits_to_add=1)

        # Analyze the script with AI
        analysis_result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=request.script_content,
            project_id=request.project_id,
            analysis_type=request.analysis_type,
        )

        # ai_engine_service returns a structured dict with "error" on failures/timeouts.
        if isinstance(analysis_result, dict) and analysis_result.get("error"):
            _raise_for_ai_error(str(analysis_result["error"]))
        response_language = _resolve_response_language(
            script_content=request.script_content,
            analysis_result=analysis_result,
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
                    suggestion_type = infer_suggestion_type(clean_note)
                    priority, confidence = infer_suggestion_priority_confidence(
                        clean_note,
                        suggestion_type,
                    )
                    await ai_suggestion_service.create_from_ai_result(
                        db=db,
                        organization_id=organization_id,
                        project_id=request.project_id,
                        suggestion_type=suggestion_type,
                        suggestion_text=clean_note,
                        confidence=confidence,
                        priority=priority,
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
            equipment_title, equipment_description = _equipment_recommendation_copy(
                response_language,
                equipment_list,
            )
            await ai_recommendation_service.create_from_ai_result(
                db=db,
                organization_id=organization_id,
                project_id=request.project_id,
                recommendation_type="equipment",
                title=equipment_title,
                description=equipment_description,
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

            schedule_title, schedule_description, action_items = _schedule_recommendation_copy(
                response_language,
                scene_count,
                len(locations),
            )

            await ai_recommendation_service.create_from_ai_result(
                db=db,
                organization_id=organization_id,
                project_id=request.project_id,
                recommendation_type="schedule",
                title=schedule_title,
                description=schedule_description,
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
            "message": _localized_text(
                response_language,
                pt_br="Análise de roteiro concluída",
                en="Script analysis completed",
            ),
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
        await ensure_and_reserve_ai_credits(db, organization, credits_to_add=1)

        result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=request.text
        )
        if isinstance(result, dict) and result.get("error"):
            _raise_for_ai_error(str(result["error"]))

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
