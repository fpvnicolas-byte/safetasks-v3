from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.core.schemas import SuccessResponse, ListResponse

from . import schemas, services

# Create router
router = APIRouter(prefix="/production", tags=["production"])

# Initialize services
script_svc = services.script_service
breakdown_svc = services.breakdown_service


# Script endpoints
@router.post("/scripts/upload", response_model=SuccessResponse[schemas.ScriptUploadResponse])
async def upload_script(
    title: str = Form(..., description="Script title"),
    file: UploadFile = File(..., description="Script file"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload and process a script file."""
    try:
        # Read file content
        content = await file.read()
        content_text = content.decode('utf-8')

        # Create script record
        script = await script_svc.create_script_with_file(
            db=db,
            title=title,
            content_text=content_text,
            file_name=file.filename,
            file_size=len(content),
            mime_type=file.content_type,
            created_by=current_user["user_id"]
        )

        # Start background breakdown processing (placeholder - implement async task)
        # TODO: Implement background task processing for AI breakdown

        return SuccessResponse(
            data=schemas.ScriptUploadResponse(
                script_id=script.id,
                title=script.title,
                file_name=script.file_name,
                file_size_bytes=script.file_size_bytes,
                message="Script uploaded successfully. Processing breakdown..."
            ),
            message="Script uploaded successfully"
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a valid text file (UTF-8 encoded)"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process script: {str(e)}"
        )


@router.get("/scripts", response_model=ListResponse[schemas.ScriptRead])
async def read_scripts(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    processed: Optional[bool] = None
):
    """Get paginated list of scripts."""
    filters = schemas.ScriptFilter(
        search=search,
        processed=processed,
        created_by=current_user["user_id"]  # Users can only see their own scripts
    )

    skip = (page - 1) * page_size

    scripts = await script_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="created_at",
        order_desc=True
    )

    total = await script_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=scripts,
        pagination={
            "items": scripts,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(scripts)} scripts"
    )


@router.get("/scripts/{script_id}", response_model=SuccessResponse[schemas.ScriptRead])
async def read_script(
    script_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get script by ID."""
    script = await script_svc.get(db=db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    # Check ownership
    if script.created_by != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return SuccessResponse(data=script, message="Script retrieved successfully")


@router.get("/scripts/{script_id}/breakdown", response_model=SuccessResponse[schemas.ScriptWithBreakdown])
async def get_script_breakdown(
    script_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get complete script with all scenes and breakdown items."""
    # Check script ownership
    script = await script_svc.get(db=db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    if script.created_by != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get script with breakdown data
    breakdown_data = await script_svc.get_script_with_scenes(db=db, script_id=script_id)
    if not breakdown_data:
        raise HTTPException(status_code=404, detail="Script breakdown data not found")

    # Format response
    scenes_with_breakdown = []
    for scene in breakdown_data["scenes"]:
        scenes_with_breakdown.append(schemas.SceneWithBreakdown(
            scene=scene,
            breakdown_items=scene.breakdown_items
        ))

    response_data = schemas.ScriptWithBreakdown(
        script=breakdown_data["script"],
        scenes=scenes_with_breakdown,
        total_scenes=breakdown_data["total_scenes"],
        total_breakdown_items=breakdown_data["total_breakdown_items"]
    )

    return SuccessResponse(
        data=response_data,
        message="Script breakdown retrieved successfully"
    )


@router.post("/scripts/{script_id}/process", response_model=SuccessResponse[schemas.ScriptBreakdownResponse])
async def process_script_breakdown(
    script_id: int,
    force_reprocess: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Trigger AI breakdown processing for a script."""
    # Check script ownership
    script = await script_svc.get(db=db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    if script.created_by != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Process breakdown
        result = await breakdown_svc.process_script_breakdown(
            db=db,
            script_id=script_id,
            force_reprocess=force_reprocess
        )

        return SuccessResponse(
            data=schemas.ScriptBreakdownResponse(**result),
            message="Script breakdown processing completed"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Breakdown processing failed: {str(e)}"
        )


@router.get("/scripts/{script_id}/statistics", response_model=SuccessResponse[schemas.ScriptBreakdownStatistics])
async def get_script_statistics(
    script_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get breakdown statistics for a script."""
    # Check script ownership
    script = await script_svc.get(db=db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    if script.created_by != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    statistics = await breakdown_svc.get_breakdown_statistics(db=db, script_id=script_id)

    return SuccessResponse(
        data=schemas.ScriptBreakdownStatistics(**statistics),
        message="Script statistics retrieved successfully"
    )


@router.delete("/scripts/{script_id}", response_model=SuccessResponse[dict])
async def delete_script(
    script_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a script and all its associated data."""
    # Check script ownership
    script = await script_svc.get(db=db, id=script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    if script.created_by != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete script (cascade will handle scenes and breakdown items)
    await script_svc.remove(db=db, id=script_id)

    return SuccessResponse(
        data={"id": script_id},
        message="Script and all associated data deleted successfully"
    )


# Scene endpoints
@router.get("/scenes", response_model=ListResponse[schemas.SceneRead])
async def read_scenes(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = 1,
    page_size: int = 50,
    script_id: Optional[int] = None,
    search: Optional[str] = None,
    time_of_day: Optional[str] = None
):
    """Get paginated list of scenes."""
    # For now, get all scenes - in production, add user ownership checks
    from app.core.crud import CRUDBase
    from .models import Scene

    scene_crud = CRUDBase(Scene)
    filters = schemas.SceneFilter(
        script_id=script_id,
        search=search,
        time_of_day=time_of_day
    )

    skip = (page - 1) * page_size

    scenes = await scene_crud.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="scene_number"
    )

    total = await scene_crud.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=scenes,
        pagination={
            "items": scenes,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(scenes)} scenes"
    )


# Breakdown items endpoints
@router.get("/breakdown-items", response_model=ListResponse[schemas.BreakdownItemRead])
async def read_breakdown_items(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = 1,
    page_size: int = 50,
    scene_id: Optional[int] = None,
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get paginated list of breakdown items."""
    # For now, get all items - in production, add user ownership checks
    from app.core.crud import CRUDBase
    from .models import BreakdownItem

    item_crud = CRUDBase(BreakdownItem)
    filters = schemas.BreakdownItemFilter(
        scene_id=scene_id,
        category=category,
        search=search
    )

    skip = (page - 1) * page_size

    items = await item_crud.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="category"
    )

    total = await item_crud.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=items,
        pagination={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        message=f"Found {len(items)} breakdown items"
    )