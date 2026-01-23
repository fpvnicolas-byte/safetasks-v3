from typing import Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, get_current_profile
from app.db.session import get_db
from app.services.ai_engine import ai_engine_service
from app.services.notifications import notification_service
from app.services.storage import storage_service


router = APIRouter()


async def process_script_analysis(
    organization_id: UUID,
    project_id: UUID,
    script_content: str,
    profile_id: UUID,
    db: AsyncSession
):
    """
    Background task to process script analysis and send notifications.
    """
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

        # Create notification for the user
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile_id,
            title="Script Analysis Complete",
            message=f"AI analysis of your script is ready. Found {len(analysis_result.get('characters', []))} characters and {len(analysis_result.get('scenes', []))} scenes.",
            type="success",
            metadata={
                "analysis_result": analysis_result,
                "suggestions": suggestions,
                "project_id": str(project_id)
            }
        )

    except Exception as e:
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


@router.post("/projects/{project_id}/analyze-script")
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


@router.get("/analysis/status/{request_id}")
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


@router.post("/analyze-text")
async def analyze_text_content(
    text: str,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Analyze arbitrary text content with AI.
    This is a synchronous endpoint for quick analysis.
    """
    try:
        # For small text analysis, do it synchronously
        if len(text) > 10000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text too long for synchronous analysis. Use project script analysis instead."
            )

        result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content=text
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
