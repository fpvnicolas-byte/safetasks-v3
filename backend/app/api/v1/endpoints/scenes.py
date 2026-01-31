from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_owner_admin_or_producer,
    require_read_only,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.production import scene_service
from app.schemas.production import Scene, SceneCreate, SceneUpdate

router = APIRouter()


@router.get("/", response_model=List[Scene], dependencies=[Depends(require_read_only)])
async def get_scenes(
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: UUID = None,
) -> List[Scene]:
    """
    Get all scenes for the current user's organization.
    """
    filters = {}
    if project_id:
        await enforce_project_assignment(project_id, db, profile)
        filters["project_id"] = project_id
    elif get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        filters["project_id"] = assigned_project_ids

    scenes = await scene_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return scenes


@router.post(
    "/",
    response_model=Scene,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_scene(
    scene_in: SceneCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Scene:
    """
    Create a new scene in the current user's organization.
    Only admins and managers can create scenes.
    """
    try:
        scene = await scene_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=scene_in
        )
        return scene
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{scene_id}", response_model=Scene, dependencies=[Depends(require_read_only)])
async def get_scene(
    scene_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Scene:
    """
    Get scene by ID (must belong to current user's organization).
    """
    scene = await scene_service.get(
        db=db,
        organization_id=organization_id,
        id=scene_id
    )

    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene not found"
        )

    await enforce_project_assignment(scene.project_id, db, profile)

    return scene


@router.put(
    "/{scene_id}",
    response_model=Scene,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_scene(
    scene_id: UUID,
    scene_in: SceneUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Scene:
    """
    Update scene (must belong to current user's organization).
    Only admins and managers can update scenes.
    """
    try:
        scene = await scene_service.update(
            db=db,
            organization_id=organization_id,
            id=scene_id,
            obj_in=scene_in
        )

        if not scene:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scene not found"
            )

        return scene
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{scene_id}",
    response_model=Scene,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_scene(
    scene_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Scene:
    """
    Delete scene (must belong to current user's organization).
    Only admins and managers can delete scenes.
    """
    scene = await scene_service.remove(
        db=db,
        organization_id=organization_id,
        id=scene_id
    )

    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene not found"
        )

    return scene
