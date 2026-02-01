from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.db.session import get_db
from app.models.services import Service as ServiceModel, ServiceEquipment as ServiceEquipmentModel
from app.models.kits import Kit as KitModel
from app.schemas.services import Service, ServiceCreate, ServiceUpdate, ServiceEquipmentCreate, ServiceEquipmentResponse

router = APIRouter()

@router.get("/", response_model=List[Service], dependencies=[Depends(deps.require_read_only)])
async def read_services(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Retrieve services.
    """
    result = await db.execute(
        select(ServiceModel)
        .where(ServiceModel.organization_id == current_user.organization_id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.post(
    "/",
    response_model=Service,
    dependencies=[Depends(deps.require_owner_admin_or_producer), Depends(deps.require_billing_active)]
)
async def create_service(
    *,
    db: AsyncSession = Depends(get_db),
    service_in: ServiceCreate,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Create new service.
    """
    service = ServiceModel(
        **service_in.model_dump(),
        organization_id=current_user.organization_id
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service

@router.put(
    "/{service_id}",
    response_model=Service,
    dependencies=[Depends(deps.require_owner_admin_or_producer), Depends(deps.require_billing_active)]
)
async def update_service(
    *,
    db: AsyncSession = Depends(get_db),
    service_id: UUID,
    service_in: ServiceUpdate,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Update a service.
    """
    result = await db.execute(
        select(ServiceModel)
        .where(ServiceModel.id == service_id)
        .where(ServiceModel.organization_id == current_user.organization_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)

    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service

@router.delete(
    "/{service_id}",
    response_model=Service,
    dependencies=[Depends(deps.require_owner_admin_or_producer), Depends(deps.require_billing_active)]
)
async def delete_service(
    *,
    db: AsyncSession = Depends(get_db),
    service_id: UUID,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Delete a service.
    """
    result = await db.execute(
        select(ServiceModel)
        .where(ServiceModel.id == service_id)
        .where(ServiceModel.organization_id == current_user.organization_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    await db.delete(service)
    await db.commit()
    return service


@router.post(
    "/{service_id}/equipment",
    response_model=ServiceEquipmentResponse,
    dependencies=[Depends(deps.require_owner_admin_or_producer), Depends(deps.require_billing_active)]
)
async def link_equipment_to_service(
    service_id: UUID,
    equipment_in: ServiceEquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """Link an equipment kit to a service."""
    # Verify service exists
    result = await db.execute(
        select(ServiceModel)
        .where(ServiceModel.id == service_id)
        .where(ServiceModel.organization_id == current_user.organization_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Verify kit exists
    result = await db.execute(
        select(KitModel)
        .where(KitModel.id == equipment_in.kit_id)
        .where(KitModel.organization_id == current_user.organization_id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    # Check if link already exists
    result = await db.execute(
        select(ServiceEquipmentModel)
        .where(ServiceEquipmentModel.service_id == service_id)
        .where(ServiceEquipmentModel.kit_id == equipment_in.kit_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Equipment already linked to this service")

    # Create link
    link = ServiceEquipmentModel(
        organization_id=current_user.organization_id,
        service_id=service_id,
        kit_id=equipment_in.kit_id,
        is_primary=equipment_in.is_primary,
        notes=equipment_in.notes
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    # Return with kit name
    return ServiceEquipmentResponse(
        id=link.id,
        service_id=link.service_id,
        kit_id=link.kit_id,
        kit_name=kit.name,
        is_primary=link.is_primary,
        notes=link.notes,
        created_at=link.created_at
    )


@router.get(
    "/{service_id}/equipment",
    response_model=List[ServiceEquipmentResponse],
    dependencies=[Depends(deps.require_read_only)]
)
async def get_service_equipment(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """Get all equipment linked to a service."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(ServiceEquipmentModel)
        .options(selectinload(ServiceEquipmentModel.kit))
        .where(ServiceEquipmentModel.service_id == service_id)
        .where(ServiceEquipmentModel.organization_id == current_user.organization_id)
    )
    links = result.scalars().all()

    return [
        ServiceEquipmentResponse(
            id=link.id,
            service_id=link.service_id,
            kit_id=link.kit_id,
            kit_name=link.kit.name if link.kit else None,
            is_primary=link.is_primary,
            notes=link.notes,
            created_at=link.created_at
        )
        for link in links
    ]


@router.delete(
    "/{service_id}/equipment/{kit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(deps.require_owner_admin_or_producer), Depends(deps.require_billing_active)]
)
async def unlink_equipment_from_service(
    service_id: UUID,
    kit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(deps.get_current_profile),
) -> None:
    """Remove equipment link from a service."""
    result = await db.execute(
        select(ServiceEquipmentModel)
        .where(ServiceEquipmentModel.service_id == service_id)
        .where(ServiceEquipmentModel.kit_id == kit_id)
        .where(ServiceEquipmentModel.organization_id == current_user.organization_id)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Equipment link not found")

    await db.delete(link)
    await db.commit()
