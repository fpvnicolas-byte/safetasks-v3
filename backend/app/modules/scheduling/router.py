from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.core.schemas import SuccessResponse, ListResponse

from . import schemas, services

# Create router
router = APIRouter(prefix="/scheduling", tags=["scheduling"])

# Initialize services
shooting_day_svc = services.shooting_day_service
event_svc = services.event_service
call_sheet_svc = services.call_sheet_service


# Shooting Day endpoints
@router.get("/shooting-days", response_model=ListResponse[schemas.ShootingDayRead])
async def read_shooting_days(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    location: Optional[str] = Query(None, description="Filter by location")
):
    """Get paginated list of shooting days with statistics."""
    from datetime import date

    # Parse dates
    filters = schemas.ShootingDayFilter(
        date_from=date.fromisoformat(date_from) if date_from else None,
        date_to=date.fromisoformat(date_to) if date_to else None,
        status=status,
        location=location
    )

    skip = (page - 1) * page_size

    shooting_days_data = await shooting_day_svc.get_shooting_days_with_stats(
        db=db,
        filters=filters,
        skip=skip,
        limit=page_size
    )

    # Get total count
    total = await shooting_day_svc.get_count(db=db)

    return ListResponse(
        data=[item['shooting_day'] for item in shooting_days_data],
        pagination={
            "items": [item['shooting_day'] for item in shooting_days_data],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1
        },
        message=f"Found {len(shooting_days_data)} shooting days"
    )


@router.get("/shooting-days/{shooting_day_id}", response_model=SuccessResponse[schemas.ShootingDayRead])
async def read_shooting_day(
    shooting_day_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get shooting day by ID."""
    shooting_day = await shooting_day_svc.get(db=db, id=shooting_day_id)
    if not shooting_day:
        raise HTTPException(status_code=404, detail="Shooting day not found")

    return SuccessResponse(data=shooting_day, message="Shooting day retrieved successfully")


@router.post("/shooting-days", response_model=SuccessResponse[schemas.ShootingDayRead], status_code=201)
async def create_shooting_day(
    shooting_day_in: schemas.ShootingDayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new shooting day."""
    # Add created_by user
    shooting_day_data = shooting_day_in.model_dump()
    shooting_day_data['created_by'] = current_user["user_id"]
    shooting_day_data['updated_by'] = current_user["user_id"]

    shooting_day = await shooting_day_svc.create(db=db, obj_in=shooting_day_data)
    return SuccessResponse(data=shooting_day, message="Shooting day created successfully")


@router.put("/shooting-days/{shooting_day_id}", response_model=SuccessResponse[schemas.ShootingDayRead])
async def update_shooting_day(
    shooting_day_id: int,
    shooting_day_in: schemas.ShootingDayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update shooting day."""
    shooting_day = await shooting_day_svc.get(db=db, id=shooting_day_id)
    if not shooting_day:
        raise HTTPException(status_code=404, detail="Shooting day not found")

    updated_shooting_day = await shooting_day_svc.update(
        db=db, db_obj=shooting_day, obj_in=shooting_day_in
    )
    return SuccessResponse(data=updated_shooting_day, message="Shooting day updated successfully")


@router.delete("/shooting-days/{shooting_day_id}", response_model=SuccessResponse[dict])
async def delete_shooting_day(
    shooting_day_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete shooting day."""
    shooting_day = await shooting_day_svc.exists(db=db, id=shooting_day_id)
    if not shooting_day:
        raise HTTPException(status_code=404, detail="Shooting day not found")

    await shooting_day_svc.remove(db=db, id=shooting_day_id)
    return SuccessResponse(data={"id": shooting_day_id}, message="Shooting day deleted successfully")


# Event endpoints
@router.get("/events", response_model=ListResponse[schemas.EventRead])
async def read_events(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    shooting_day_id: Optional[int] = Query(None, description="Filter by shooting day ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    scene_id: Optional[int] = Query(None, description="Filter by scene ID")
):
    """Get paginated list of events."""
    filters = schemas.EventFilter(
        shooting_day_id=shooting_day_id,
        event_type=event_type,
        status=status,
        scene_id=scene_id
    )

    skip = (page - 1) * page_size

    events = await event_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="start_time"
    )

    total = await event_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=events,
        pagination={
            "items": events,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page * page_size < total,
            "has_prev": page > 1
        },
        message=f"Found {len(events)} events"
    )


@router.get("/events/{event_id}", response_model=SuccessResponse[schemas.EventRead])
async def read_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get event by ID."""
    event = await event_svc.get(db=db, id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return SuccessResponse(data=event, message="Event retrieved successfully")


@router.post("/events", response_model=SuccessResponse[schemas.EventRead], status_code=201)
async def create_event(
    event_in: schemas.EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new event."""
    event = await event_svc.create(db=db, obj_in=event_in)
    # Calculate duration
    event.calculate_duration()
    await db.commit()
    await db.refresh(event)

    return SuccessResponse(data=event, message="Event created successfully")


@router.put("/events/{event_id}", response_model=SuccessResponse[schemas.EventRead])
async def update_event(
    event_id: int,
    event_in: schemas.EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update event."""
    event = await event_svc.get(db=db, id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    updated_event = await event_svc.update(db=db, db_obj=event, obj_in=event_in)
    # Recalculate duration
    updated_event.calculate_duration()
    await db.commit()
    await db.refresh(updated_event)

    return SuccessResponse(data=updated_event, message="Event updated successfully")


@router.delete("/events/{event_id}", response_model=SuccessResponse[dict])
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete event."""
    event = await event_svc.exists(db=db, id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await event_svc.remove(db=db, id=event_id)
    return SuccessResponse(data={"id": event_id}, message="Event deleted successfully")


# Conflict detection and optimization
@router.post("/conflicts/detect", response_model=SuccessResponse[schemas.ConflictDetectionResponse])
async def detect_conflicts(
    request: schemas.ConflictDetectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Detect scheduling conflicts for a shooting day."""
    try:
        result = await event_svc.detect_conflicts(db=db, request=request)
        return SuccessResponse(data=result, message="Conflict detection completed")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conflict detection failed: {str(e)}"
        )


@router.post("/schedule/optimize", response_model=SuccessResponse[schemas.ScheduleOptimizationResponse])
async def optimize_schedule(
    request: schemas.ScheduleOptimizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Optimize schedule for a shooting day."""
    try:
        result = await event_svc.optimize_schedule(db=db, request=request)
        return SuccessResponse(data=result, message="Schedule optimization completed")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schedule optimization failed: {str(e)}"
        )


# Call Sheet endpoints
@router.get("/call-sheets", response_model=ListResponse[schemas.CallSheetRead])
async def read_call_sheets(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    shooting_day_id: Optional[int] = Query(None, description="Filter by shooting day ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    version: Optional[int] = Query(None, description="Filter by version")
):
    """Get paginated list of call sheets."""
    filters = schemas.CallSheetFilter(
        shooting_day_id=shooting_day_id,
        status=status,
        version=version
    )

    skip = (page - 1) * page_size

    call_sheets = await call_sheet_svc.get_multi(
        db=db,
        skip=skip,
        limit=page_size,
        filters=filters,
        order_by="created_at",
        order_desc=True
    )

    total = await call_sheet_svc.get_count(db=db, filters=filters)
    total_pages = (total + page_size - 1) // page_size

    return ListResponse(
        data=call_sheets,
        pagination={
            "items": call_sheets,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page * page_size < total,
            "has_prev": page > 1
        },
        message=f"Found {len(call_sheets)} call sheets"
    )


@router.get("/call-sheets/{call_sheet_id}", response_model=SuccessResponse[schemas.CallSheetRead])
async def read_call_sheet(
    call_sheet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get call sheet by ID."""
    call_sheet = await call_sheet_svc.get(db=db, id=call_sheet_id)
    if not call_sheet:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    return SuccessResponse(data=call_sheet, message="Call sheet retrieved successfully")


@router.post("/call-sheets/generate", response_model=SuccessResponse[schemas.CallSheetRead], status_code=201)
async def generate_call_sheet(
    request: schemas.CallSheetGenerationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Generate a new call sheet for a shooting day."""
    try:
        call_sheet = await call_sheet_svc.generate_call_sheet(
            db=db,
            shooting_day_id=request.shooting_day_id,
            template_version=request.template_version
        )
        return SuccessResponse(data=call_sheet, message="Call sheet generated successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Call sheet generation failed: {str(e)}"
        )


@router.post("/call-sheets/{call_sheet_id}/distribute", response_model=SuccessResponse[schemas.CallSheetRead])
async def distribute_call_sheet(
    call_sheet_id: int,
    request: schemas.CallSheetDistributionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Distribute call sheet to recipients."""
    try:
        call_sheet = await call_sheet_svc.distribute_call_sheet(
            db=db,
            call_sheet_id=call_sheet_id,
            recipients=request.recipients,
            message=request.message
        )
        return SuccessResponse(data=call_sheet, message="Call sheet distributed successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/call-sheets/{call_sheet_id}/full", response_model=SuccessResponse[Dict[str, Any]])
async def get_call_sheet_with_schedule(
    call_sheet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get call sheet with complete schedule information."""
    result = await call_sheet_svc.get_call_sheet_with_schedule(db=db, call_sheet_id=call_sheet_id)
    if not result:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    return SuccessResponse(data=result, message="Call sheet with schedule retrieved successfully")


@router.put("/call-sheets/{call_sheet_id}", response_model=SuccessResponse[schemas.CallSheetRead])
async def update_call_sheet(
    call_sheet_id: int,
    call_sheet_in: schemas.CallSheetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update call sheet."""
    call_sheet = await call_sheet_svc.get(db=db, id=call_sheet_id)
    if not call_sheet:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    updated_call_sheet = await call_sheet_svc.update(
        db=db, db_obj=call_sheet, obj_in=call_sheet_in
    )
    return SuccessResponse(data=updated_call_sheet, message="Call sheet updated successfully")


@router.delete("/call-sheets/{call_sheet_id}", response_model=SuccessResponse[dict])
async def delete_call_sheet(
    call_sheet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete call sheet."""
    call_sheet = await call_sheet_svc.exists(db=db, id=call_sheet_id)
    if not call_sheet:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    await call_sheet_svc.remove(db=db, id=call_sheet_id)
    return SuccessResponse(data={"id": call_sheet_id}, message="Call sheet deleted successfully")