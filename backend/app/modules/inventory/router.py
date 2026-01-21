from typing import List, Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.core.schemas import SuccessResponse, ListResponse

from . import schemas, services

# Create router
router = APIRouter(prefix="/inventory", tags=["inventory"])

# Initialize services
equipment_svc = services.equipment_service
kit_svc = services.kit_service
kit_item_svc = services.kit_item_service
maintenance_svc = services.maintenance_service


# Equipment endpoints
@router.get("/equipment", response_model=ListResponse[schemas.EquipmentRead])
async def read_equipment(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    assigned_to_user: Optional[str] = Query(None, description="Filter by assigned user"),
    assigned_to_project: Optional[str] = Query(None, description="Filter by assigned project"),
    is_due_maintenance: Optional[bool] = Query(None, description="Filter by maintenance due"),
    search: Optional[str] = Query(None, description="Search in name and description")
):
    """Get paginated list of equipment with optional filters."""
    filters = schemas.EquipmentFilter(
        category=category,
        status=status,
        condition=condition,
        assigned_to_user=assigned_to_user,
        assigned_to_project=assigned_to_project,
        is_due_maintenance=is_due_maintenance
    )

    equipment = await equipment_svc.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by="name"
    )

    # Add computed fields
    for item in equipment:
        item.is_due_for_maintenance = item.is_due_for_maintenance()
        item.is_overdue_for_maintenance = item.is_overdue_for_maintenance()

    total = await equipment_svc.get_count(db=db, filters=filters)

    return ListResponse(
        data=equipment,
        pagination={
            "items": equipment,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(equipment)} equipment items"
    )


@router.get("/equipment/{equipment_id}", response_model=SuccessResponse[schemas.EquipmentRead])
async def read_equipment_item(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get equipment item by ID."""
    equipment = await equipment_svc.get(db=db, id=equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Add computed fields
    equipment.is_due_for_maintenance = equipment.is_due_for_maintenance()
    equipment.is_overdue_for_maintenance = equipment.is_overdue_for_maintenance()

    return SuccessResponse(data=equipment, message="Equipment retrieved successfully")


@router.post("/equipment", response_model=SuccessResponse[schemas.EquipmentRead], status_code=201)
async def create_equipment(
    equipment_in: schemas.EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new equipment item."""
    # Convert purchase price to cents if provided
    equipment_data = equipment_in.model_dump()
    if equipment_data.get('purchase_price'):
        equipment_data['purchase_price_cents'] = int(equipment_data['purchase_price'] * 100)
        del equipment_data['purchase_price']

    # Add created_by user
    equipment_data['created_by'] = current_user["user_id"]
    equipment_data['updated_by'] = current_user["user_id"]

    equipment = await equipment_svc.create(db=db, obj_in=equipment_data)

    # Calculate initial current value
    if equipment.purchase_price_cents and equipment.purchased_at:
        equipment.calculate_current_value()
        await db.commit()
        await db.refresh(equipment)

    return SuccessResponse(data=equipment, message="Equipment created successfully")


@router.put("/equipment/{equipment_id}", response_model=SuccessResponse[schemas.EquipmentRead])
async def update_equipment(
    equipment_id: int,
    equipment_in: schemas.EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update equipment item."""
    equipment = await equipment_svc.get(db=db, id=equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Handle purchase price conversion
    update_data = equipment_in.model_dump(exclude_unset=True)
    if 'purchase_price' in update_data:
        update_data['purchase_price_cents'] = int(update_data['purchase_price'] * 100)
        del update_data['purchase_price']

    updated_equipment = await equipment_svc.update(
        db=db, db_obj=equipment, obj_in=update_data
    )

    return SuccessResponse(data=updated_equipment, message="Equipment updated successfully")


@router.delete("/equipment/{equipment_id}", response_model=SuccessResponse[dict])
async def delete_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete equipment item."""
    equipment = await equipment_svc.exists(db=db, id=equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    await equipment_svc.remove(db=db, id=equipment_id)
    return SuccessResponse(data={"id": equipment_id}, message="Equipment deleted successfully")


# Equipment assignment and management
@router.post("/equipment/{equipment_id}/assign", response_model=SuccessResponse[schemas.EquipmentRead])
async def assign_equipment(
    equipment_id: int,
    request: schemas.EquipmentAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Assign equipment to a user/project."""
    try:
        equipment = await equipment_svc.assign_equipment(
            db=db,
            request=request,
            assigned_by=current_user["user_id"]
        )
        return SuccessResponse(data=equipment, message="Equipment assigned successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/equipment/{equipment_id}/return", response_model=SuccessResponse[schemas.EquipmentRead])
async def return_equipment(
    equipment_id: int,
    location: Optional[str] = None,
    usage_hours: float = Query(0.0, ge=0, description="Usage hours to record"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Return equipment to available status."""
    try:
        equipment = await equipment_svc.return_equipment(
            db=db,
            equipment_id=equipment_id,
            returned_by=current_user["user_id"],
            location=location,
            usage_hours=usage_hours
        )
        return SuccessResponse(data=equipment, message="Equipment returned successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/equipment/bulk-update", response_model=SuccessResponse[dict])
async def bulk_update_equipment(
    request: schemas.EquipmentBulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Bulk update multiple equipment items."""
    result = await equipment_svc.bulk_update_equipment(
        db=db,
        request=request,
        updated_by=current_user["user_id"]
    )
    return SuccessResponse(data=result, message="Bulk update completed")


@router.post("/equipment/calculate-depreciation", response_model=SuccessResponse[dict])
async def calculate_depreciation(
    equipment_ids: Optional[List[int]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Recalculate depreciation for equipment."""
    result = await equipment_svc.calculate_depreciation(db=db, equipment_ids=equipment_ids)
    return SuccessResponse(data=result, message="Depreciation calculation completed")


# Equipment availability and search
@router.post("/equipment/check-availability", response_model=SuccessResponse[Dict[int, bool]])
async def check_equipment_availability(
    equipment_ids: List[int],
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Check availability of multiple equipment items."""
    availability = await equipment_svc.check_availability(
        db=db,
        equipment_ids=equipment_ids,
        date_from=date_from,
        date_to=date_to
    )
    return SuccessResponse(data=availability, message="Availability check completed")


@router.get("/equipment/due-maintenance", response_model=ListResponse[schemas.EquipmentRead])
async def get_due_maintenance(
    include_overdue: bool = Query(True, description="Include overdue maintenance"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get equipment due for maintenance."""
    equipment = await equipment_svc.get_due_maintenance(
        db=db,
        include_overdue=include_overdue
    )

    # Add computed fields
    for item in equipment:
        item.is_due_for_maintenance = item.is_due_for_maintenance()
        item.is_overdue_for_maintenance = item.is_overdue_for_maintenance()

    return ListResponse(
        data=equipment,
        pagination={
            "items": equipment,
            "total": len(equipment),
            "page": 1,
            "page_size": len(equipment),
            "total_pages": 1,
            "has_next": False,
            "has_prev": False
        },
        message=f"Found {len(equipment)} equipment items due for maintenance"
    )


# Kit endpoints
@router.get("/kits", response_model=ListResponse[schemas.KitRead])
async def read_kits(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    category: Optional[str] = Query(None, description="Filter by category"),
    kit_type: Optional[str] = Query(None, description="Filter by kit type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    availability_status: Optional[str] = Query(None, description="Filter by availability status")
):
    """Get paginated list of kits."""
    filters = schemas.KitFilter(
        category=category,
        kit_type=kit_type,
        status=status,
        availability_status=availability_status
    )

    kits = await kit_svc.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by="name"
    )

    total = await kit_svc.get_count(db=db, filters=filters)

    return ListResponse(
        data=kits,
        pagination={
            "items": kits,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(kits)} kits"
    )


@router.get("/kits/{kit_id}", response_model=SuccessResponse[schemas.KitRead])
async def read_kit(
    kit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get kit by ID."""
    kit = await kit_svc.get(db=db, id=kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    return SuccessResponse(data=kit, message="Kit retrieved successfully")


@router.post("/kits", response_model=SuccessResponse[schemas.KitRead], status_code=201)
async def create_kit(
    kit_in: schemas.KitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new kit with equipment items."""
    kit = await kit_svc.create_kit_with_items(
        db=db,
        kit_data=kit_in,
        created_by=current_user["user_id"]
    )
    return SuccessResponse(data=kit, message="Kit created successfully")


@router.put("/kits/{kit_id}", response_model=SuccessResponse[schemas.KitRead])
async def update_kit(
    kit_id: int,
    kit_in: schemas.KitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update kit."""
    kit = await kit_svc.get(db=db, id=kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    updated_kit = await kit_svc.update(db=db, db_obj=kit, obj_in=kit_in)
    return SuccessResponse(data=updated_kit, message="Kit updated successfully")


@router.delete("/kits/{kit_id}", response_model=SuccessResponse[dict])
async def delete_kit(
    kit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete kit."""
    kit = await kit_svc.exists(db=db, id=kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    await kit_svc.remove(db=db, id=kit_id)
    return SuccessResponse(data={"id": kit_id}, message="Kit deleted successfully")


@router.post("/kits/{kit_id}/assemble", response_model=SuccessResponse[dict])
async def assemble_kit(
    kit_id: int,
    request: schemas.KitAssemblyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Assemble kit by adding equipment items."""
    result = await kit_svc.assemble_kit(
        db=db,
        request=request,
        assembled_by=current_user["user_id"]
    )
    return SuccessResponse(data=result, message="Kit assembly completed")


@router.get("/kits/{kit_id}/availability", response_model=SuccessResponse[dict])
async def check_kit_availability(
    kit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Check kit availability."""
    result = await kit_svc.check_kit_availability(db=db, kit_id=kit_id)
    return SuccessResponse(data=result, message="Kit availability checked")


@router.get("/kits/{kit_id}/full", response_model=SuccessResponse[schemas.KitWithItems])
async def get_kit_with_items(
    kit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get kit with all its items and equipment details."""
    result = await kit_item_svc.get_kit_with_items(db=db, kit_id=kit_id)
    if not result:
        raise HTTPException(status_code=404, detail="Kit not found")

    kit_data = schemas.KitWithItems(**result)
    return SuccessResponse(data=kit_data, message="Kit with items retrieved successfully")


# Maintenance endpoints
@router.get("/maintenance", response_model=ListResponse[schemas.MaintenanceLogRead])
async def read_maintenance_logs(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    equipment_id: Optional[int] = Query(None, description="Filter by equipment ID"),
    maintenance_type: Optional[str] = Query(None, description="Filter by maintenance type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    scheduled_from: Optional[date] = Query(None, description="Filter scheduled from date"),
    scheduled_to: Optional[date] = Query(None, description="Filter scheduled to date")
):
    """Get paginated list of maintenance logs."""
    filters = schemas.MaintenanceLogFilter(
        equipment_id=equipment_id,
        maintenance_type=maintenance_type,
        status=status,
        priority=priority,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to
    )

    maintenance_logs = await maintenance_svc.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by="scheduled_date",
        order_desc=True
    )

    total = await maintenance_svc.get_count(db=db, filters=filters)

    return ListResponse(
        data=maintenance_logs,
        pagination={
            "items": maintenance_logs,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(maintenance_logs)} maintenance logs"
    )


@router.get("/maintenance/{maintenance_id}", response_model=SuccessResponse[schemas.MaintenanceLogRead])
async def read_maintenance_log(
    maintenance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get maintenance log by ID."""
    maintenance_log = await maintenance_svc.get(db=db, id=maintenance_id)
    if not maintenance_log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    return SuccessResponse(data=maintenance_log, message="Maintenance log retrieved successfully")


@router.post("/maintenance", response_model=ListResponse[schemas.MaintenanceLogRead], status_code=201)
async def schedule_maintenance(
    request: schemas.MaintenanceScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Schedule maintenance for multiple equipment items."""
    maintenance_logs = await maintenance_svc.schedule_maintenance(
        db=db,
        request=request,
        scheduled_by=current_user["user_id"]
    )

    return ListResponse(
        data=maintenance_logs,
        pagination={
            "items": maintenance_logs,
            "total": len(maintenance_logs),
            "page": 1,
            "page_size": len(maintenance_logs),
            "total_pages": 1,
            "has_next": False,
            "has_prev": False
        },
        message=f"Maintenance scheduled for {len(maintenance_logs)} equipment items"
    )


@router.post("/maintenance/{maintenance_id}/complete", response_model=SuccessResponse[schemas.MaintenanceLogRead])
async def complete_maintenance(
    maintenance_id: int,
    completion_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Mark maintenance as completed."""
    maintenance_log = await maintenance_svc.complete_maintenance(
        db=db,
        maintenance_id=maintenance_id,
        completion_data=completion_data,
        completed_by=current_user["user_id"]
    )
    return SuccessResponse(data=maintenance_log, message="Maintenance completed successfully")


@router.delete("/maintenance/{maintenance_id}", response_model=SuccessResponse[dict])
async def delete_maintenance_log(
    maintenance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete maintenance log."""
    maintenance_log = await maintenance_svc.exists(db=db, id=maintenance_id)
    if not maintenance_log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    await maintenance_svc.remove(db=db, id=maintenance_id)
    return SuccessResponse(data={"id": maintenance_id}, message="Maintenance log deleted successfully")


# Maintenance reporting
@router.get("/maintenance/overdue", response_model=ListResponse[schemas.MaintenanceLogRead])
async def get_overdue_maintenance(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get all overdue maintenance."""
    overdue = await maintenance_svc.get_overdue_maintenance(db=db)
    return ListResponse(
        data=overdue,
        pagination={
            "items": overdue,
            "total": len(overdue),
            "page": 1,
            "page_size": len(overdue),
            "total_pages": 1,
            "has_next": False,
            "has_prev": False
        },
        message=f"Found {len(overdue)} overdue maintenance items"
    )


@router.get("/maintenance/upcoming", response_model=ListResponse[schemas.MaintenanceLogRead])
async def get_upcoming_maintenance(
    days_ahead: int = Query(30, ge=1, le=365, description="Days to look ahead"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get upcoming maintenance within specified days."""
    upcoming = await maintenance_svc.get_upcoming_maintenance(db=db, days_ahead=days_ahead)
    return ListResponse(
        data=upcoming,
        pagination={
            "items": upcoming,
            "total": len(upcoming),
            "page": 1,
            "page_size": len(upcoming),
            "total_pages": 1,
            "has_next": False,
            "has_prev": False
        },
        message=f"Found {len(upcoming)} upcoming maintenance items"
    )


@router.get("/reports/inventory", response_model=SuccessResponse[schemas.EquipmentInventoryReport])
async def get_inventory_report(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Generate comprehensive inventory report."""
    report = await equipment_svc.generate_inventory_report(db=db)
    return SuccessResponse(data=report, message="Inventory report generated successfully")


@router.get("/reports/maintenance", response_model=SuccessResponse[schemas.MaintenanceReport])
async def get_maintenance_report(
    start_date: Optional[date] = Query(None, description="Start date for report"),
    end_date: Optional[date] = Query(None, description="End date for report"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Generate maintenance activity report."""
    report = await maintenance_svc.generate_maintenance_report(
        db=db,
        start_date=start_date,
        end_date=end_date
    )
    return SuccessResponse(data=report, message="Maintenance report generated successfully")