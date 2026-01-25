from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_organization_from_profile, require_admin_or_manager
from app.db.session import get_db
from app.services.maintenance import (
    kit_item_service, maintenance_service, inventory_health_service
)
from app.schemas.inventory import (
    KitItem, KitItemCreate, KitItemUpdate, KitItemWithMaintenance,
    MaintenanceLog, MaintenanceLogCreate,
    KitItemMaintenanceHistory, InventoryHealthReport
)


router = APIRouter()


@router.get("/items/", response_model=List[KitItem])
async def get_kit_items(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    kit_id: UUID = None,
    category: str = None,
    health_status: str = None,
) -> List[KitItem]:
    """
    Get all kit items for the current user's organization.
    """
    filters = {}
    if kit_id:
        filters["kit_id"] = kit_id
    if category:
        filters["category"] = category
    if health_status:
        filters["health_status"] = health_status

    kit_items = await kit_item_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return kit_items


@router.post("/items/", response_model=KitItem, dependencies=[Depends(require_admin_or_manager)])
async def create_kit_item(
    kit_item_in: KitItemCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> KitItem:
    """
    Create a new kit item in the current user's organization.
    Only admins and managers can create kit items.
    """
    try:
        kit_item = await kit_item_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=kit_item_in
        )
        return kit_item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/items/{kit_item_id}", response_model=KitItemWithMaintenance)
async def get_kit_item(
    kit_item_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> KitItemWithMaintenance:
    """
    Get kit item by ID with maintenance summary.
    """
    kit_item_info = await kit_item_service.get_with_maintenance_info(
        db=db, organization_id=organization_id, kit_item_id=kit_item_id
    )

    if not kit_item_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kit item not found"
        )

    # Convert dict to response model
    from app.schemas.inventory import KitItemWithMaintenance
    return KitItemWithMaintenance(**kit_item_info)


@router.put("/items/{kit_item_id}", response_model=KitItem, dependencies=[Depends(require_admin_or_manager)])
async def update_kit_item(
    kit_item_id: UUID,
    kit_item_in: KitItemUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> KitItem:
    """
    Update kit item (must belong to current user's organization).
    Only admins and managers can update kit items.
    """
    try:
        kit_item = await kit_item_service.update(
            db=db,
            organization_id=organization_id,
            id=kit_item_id,
            obj_in=kit_item_in
        )

        if not kit_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Kit item not found"
            )

        return kit_item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/items/{kit_item_id}", response_model=KitItem, dependencies=[Depends(require_admin_or_manager)])
async def delete_kit_item(
    kit_item_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> KitItem:
    """
    Delete kit item (must belong to current user's organization).
    Only admins and managers can delete kit items.
    """
    kit_item = await kit_item_service.remove(
        db=db,
        organization_id=organization_id,
        id=kit_item_id
    )

    if not kit_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kit item not found"
        )

    return kit_item


@router.post("/items/{kit_item_id}/maintenance", response_model=MaintenanceLog, dependencies=[Depends(require_admin_or_manager)])
async def create_maintenance_log(
    kit_item_id: UUID,
    maintenance_in: MaintenanceLogCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> MaintenanceLog:
    """
    Create a maintenance log for a kit item.
    Automatically creates financial transaction if cost > 0.
    Only admins and managers can create maintenance logs.
    """
    try:
        maintenance_log = await maintenance_service.create_maintenance_log(
            db=db,
            organization_id=organization_id,
            kit_item_id=kit_item_id,
            maintenance_data=maintenance_in
        )
        return maintenance_log
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/items/{kit_item_id}/history")
async def get_maintenance_history(
    kit_item_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> KitItemMaintenanceHistory:
    """
    Get complete maintenance history for a kit item.
    """
    try:
        history = await maintenance_service.get_maintenance_history(
            db=db,
            organization_id=organization_id,
            kit_item_id=kit_item_id
        )
        return history
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/health-report")
async def get_inventory_health_report(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> InventoryHealthReport:
    """
    Get comprehensive inventory health report.
    Shows items by health status, maintenance needs, and usage alerts.
    """
    try:
        report = await inventory_health_service.generate_health_report(
            db=db,
            organization_id=organization_id
        )
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate health report: {str(e)}"
        )


@router.post("/check-alerts", dependencies=[Depends(require_admin_or_manager)])
async def check_inventory_alerts(
    background_tasks: BackgroundTasks,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Manually trigger inventory health check and send alerts for maintenance issues.
    Only admins and managers can trigger alerts.
    """
    try:
        # Run health check and send alerts
        alert_result = await inventory_health_service.check_and_send_alerts(
            db=db,
            organization_id=organization_id
        )

        return {
            "message": f"Health check completed. Sent {alert_result['alerts_sent']} alerts.",
            "maintenance_alerts_found": alert_result["maintenance_alerts"],
            "usage_alerts_found": alert_result["usage_alerts"],
            "alerts_sent": alert_result["alerts_sent"]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check alerts: {str(e)}"
        )


@router.get("/maintenance/", response_model=List[MaintenanceLog])
async def get_maintenance_logs(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    kit_item_id: UUID = None,
    maintenance_type: str = None,
) -> List[MaintenanceLog]:
    """
    Get all maintenance logs for the current user's organization.
    """
    filters = {}
    if kit_item_id:
        filters["kit_item_id"] = kit_item_id
    if maintenance_type:
        filters["maintenance_type"] = maintenance_type

    maintenance_logs = await maintenance_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return maintenance_logs


@router.get("/maintenance/{maintenance_id}", response_model=MaintenanceLog)
async def get_maintenance_log(
    maintenance_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> MaintenanceLog:
    """
    Get maintenance log by ID (must belong to current user's organization).
    """
    maintenance_log = await maintenance_service.get(
        db=db,
        organization_id=organization_id,
        id=maintenance_id
    )

    if not maintenance_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance log not found"
        )

    return maintenance_log
