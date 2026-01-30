from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.services import Service as ServiceModel
from app.schemas.services import Service, ServiceCreate, ServiceUpdate

router = APIRouter()

@router.get("/", response_model=List[Service])
def read_services(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Retrieve services.
    """
    services = (
        db.query(ServiceModel)
        .filter(ServiceModel.organization_id == current_user.organization_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return services

@router.post("/", response_model=Service)
def create_service(
    *,
    db: Session = Depends(deps.get_db),
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
    db.commit()
    db.refresh(service)
    return service

@router.put("/{service_id}", response_model=Service)
def update_service(
    *,
    db: Session = Depends(deps.get_db),
    service_id: UUID,
    service_in: ServiceUpdate,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Update a service.
    """
    service = (
        db.query(ServiceModel)
        .filter(ServiceModel.id == service_id, ServiceModel.organization_id == current_user.organization_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)
        
    db.add(service)
    db.commit()
    db.refresh(service)
    return service

@router.delete("/{service_id}", response_model=Service)
def delete_service(
    *,
    db: Session = Depends(deps.get_db),
    service_id: UUID,
    current_user: Any = Depends(deps.get_current_profile),
) -> Any:
    """
    Delete a service.
    """
    service = (
        db.query(ServiceModel)
        .filter(ServiceModel.id == service_id, ServiceModel.organization_id == current_user.organization_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    db.delete(service)
    db.commit()
    return service
