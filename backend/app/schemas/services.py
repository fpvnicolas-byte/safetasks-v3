from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    value_cents: int = Field(default=0, ge=0, description="Service value/price in cents")


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    value_cents: Optional[int] = Field(None, ge=0)


class Service(ServiceBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Equipment linking schemas
class ServiceEquipmentCreate(BaseModel):
    """Schema for linking equipment to a service."""
    kit_id: UUID
    is_primary: bool = False
    notes: Optional[str] = None


class ServiceEquipmentResponse(BaseModel):
    """Response schema for service equipment link."""
    id: UUID
    service_id: UUID
    kit_id: UUID
    kit_name: Optional[str] = None  # Populated from relationship
    is_primary: bool
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceWithEquipment(Service):
    """Service with linked equipment."""
    equipment: List[ServiceEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
