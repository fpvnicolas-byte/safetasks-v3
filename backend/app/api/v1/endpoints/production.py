from typing import Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_owner_admin_or_producer,
    require_read_only,
    get_current_profile,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.production import production_service
from app.services.ai_engine import ai_engine_service
from app.services.notifications import notification_service
from app.schemas.production import ProjectBreakdown, AIScriptAnalysisCommit, Scene, Character
from app.models.scheduling import ShootingDay


router = APIRouter()


@router.get("/projects/{project_id}/breakdown", dependencies=[Depends(require_read_only)])
async def get_project_breakdown(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectBreakdown:
    """
    Get complete project breakdown with scenes, characters, and shooting days.
    """
    try:
        await enforce_project_assignment(project_id, db, profile)
        breakdown = await production_service.get_project_breakdown(
            db=db,
            organization_id=organization_id,
            project_id=project_id
        )
        return breakdown
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/projects/{project_id}/commit-ai-analysis",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def commit_ai_analysis(
    project_id: UUID,
    analysis_data: AIScriptAnalysisCommit,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Commit AI script analysis to database.
    Creates Scene and Character records atomically.
    Only admins and managers can commit AI analysis.
    """
    try:
        result = await production_service.commit_ai_analysis(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            analysis_data=analysis_data.analysis_data
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
            detail=f"Failed to commit AI analysis: {str(e)}"
        )


@router.post(
    "/projects/{project_id}/generate-breakdown",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def generate_breakdown_from_ai(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    organization_id: UUID = Depends(get_current_organization),
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Generate project breakdown from AI analysis.
    This is an alternative to manual scene/character creation.
    Only admins and managers can trigger AI breakdown generation.
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

        # Check if project already has scenes/characters
        existing_scenes = await production_service.scene_service.get_multi(
            db=db, organization_id=organization_id, filters={"project_id": project_id}, limit=1
        )

        if existing_scenes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project already has scenes. Use commit-ai-analysis to add more."
            )

        # Start background analysis and commit
        background_tasks.add_task(
            process_ai_breakdown_generation,
            organization_id,
            project_id,
            profile.id,
            db
        )

        # Create initial notification
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile.id,
            title="AI Breakdown Generation Started",
            message="AI is generating project breakdown from script analysis.",
            type="info",
            metadata={"project_id": str(project_id), "status": "processing"}
        )

        return {
            "message": "AI breakdown generation started. Check notifications for results.",
            "project_id": str(project_id),
            "status": "processing"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start AI breakdown generation: {str(e)}"
        )


async def process_ai_breakdown_generation(
    organization_id: UUID,
    project_id: UUID,
    profile_id: UUID,
    db: AsyncSession
):
    """
    Background task to generate complete project breakdown from AI analysis.
    """
    try:
        # Generate AI analysis
        analysis_result = await ai_engine_service.analyze_script_content(
            organization_id=organization_id,
            script_content="Sample script for demonstration",  # In real implementation, get from project
            project_id=project_id
        )

        # Commit the analysis to database
        commit_result = await production_service.commit_ai_analysis(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            analysis_data=analysis_result
        )

        # Create success notification
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile_id,
            title="AI Breakdown Generation Complete",
            message=f"Successfully created {commit_result['characters_created']} characters and {commit_result['scenes_created']} scenes.",
            type="success",
            metadata={
                "project_id": str(project_id),
                "commit_result": commit_result,
                "analysis_result": analysis_result
            }
        )

    except Exception as e:
        # Create error notification
        await notification_service.create_for_user(
            db=db,
            organization_id=organization_id,
            profile_id=profile_id,
            title="AI Breakdown Generation Failed",
            message=f"Failed to generate breakdown: {str(e)}",
            type="error",
            metadata={"error": str(e), "project_id": str(project_id)}
        )


@router.delete(
    "/projects/{project_id}/breakdown",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def clear_project_breakdown(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Clear all scenes, characters, and shooting days for a project.
    Only admins and managers can clear breakdowns.
    Use with caution - this deletes all production data.
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

        # Use transaction for atomic deletion
        async with db.begin():
            # Delete scene-character relationships first
            from app.models.production import SceneCharacter
            await db.execute(
                db.query(SceneCharacter).filter(
                    SceneCharacter.organization_id == organization_id,
                    SceneCharacter.scene_id.in_(
                        db.query(Scene.id).filter(
                            Scene.organization_id == organization_id,
                            Scene.project_id == project_id
                        )
                    )
                )
            )

            # Delete scenes
            await db.execute(
                db.query(Scene).filter(
                    Scene.organization_id == organization_id,
                    Scene.project_id == project_id
                )
            )

            # Delete characters
            await db.execute(
                db.query(Character).filter(
                    Character.organization_id == organization_id,
                    Character.project_id == project_id
                )
            )

            # Delete shooting days
            await db.execute(
                db.query(ShootingDay).filter(
                    ShootingDay.organization_id == organization_id,
                    ShootingDay.project_id == project_id
                )
            )

        return {
            "message": "Project breakdown cleared successfully",
            "project_id": str(project_id)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear breakdown: {str(e)}"
        )
