from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from enum import Enum


class MaintenanceType(str, Enum):
    preventive = "preventive"
    corrective = "corrective"
    calibration = "calibration"
    inspection = "inspection"
    upgrade = "upgrade"


class HealthStatus(str, Enum):
    excellent = "excellent"
    good = "good"
    needs_service = "needs_service"
    broken = "broken"
    retired = "retired"


class KitItemBase(BaseModel):
    """Base schema for Kit Item."""
    # CORREÇÃO: Field(..., min_length=1) -> Field(min_length=1)
    name: str = Field(min_length=1)
    description: Optional[str] = None
    category: str = Field(min_length=1)  # drone, camera, gimbal, battery, etc.
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost_cents: Optional[int] = None
    warranty_expiry: Optional[date] = None
    # CORREÇÃO: Field(..., gt=0, default=50.0) -> Field(default=50.0, gt=0)
    maintenance_interval_hours: float = Field(default=50.0, gt=0)
    max_usage_hours: float = Field(default=1000.0, gt=0)
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class KitItemCreate(KitItemBase):
    """Schema for creating a Kit Item."""
    kit_id: UUID


class KitItemUpdate(BaseModel):
    """Schema for updating a Kit Item."""
    # CORREÇÃO: Field(None, ...) -> Field(default=None, ...)
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, min_length=1)
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_cost_cents: Optional[int] = None
    warranty_expiry: Optional[date] = None
    maintenance_interval_hours: Optional[float] = Field(default=None, gt=0)
    max_usage_hours: Optional[float] = Field(default=None, gt=0)
    current_usage_hours: Optional[float] = Field(default=None, ge=0)
    last_maintenance_date: Optional[date] = None
    health_status: Optional[HealthStatus] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class KitItem(KitItemBase):
    """Schema for Kit Item response."""
    id: UUID
    organization_id: UUID
    kit_id: UUID
    current_usage_hours: float
    last_maintenance_date: Optional[date]
    health_status: HealthStatus
    created_at: datetime
    updated_at: datetime


class KitItemWithMaintenance(KitItem):
    """Schema for Kit Item response with maintenance history."""
    maintenance_count: int = 0
    last_maintenance_type: Optional[str] = None
    days_since_last_maintenance: Optional[int] = None
    maintenance_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class MaintenanceLogBase(BaseModel):
    """Base schema for Maintenance Log."""
    maintenance_type: MaintenanceType
    description: str = Field(min_length=1)
    technician_name: Optional[str] = None
    cost_cents: int = Field(default=0, ge=0)
    date: date
    duration_hours: Optional[float] = Field(default=None, gt=0)
    health_before: Optional[HealthStatus] = None
    health_after: Optional[HealthStatus] = None
    usage_hours_reset: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MaintenanceLogCreate(MaintenanceLogBase):
    """Schema for creating a Maintenance Log."""
    pass


class MaintenanceLog(MaintenanceLogBase):
    """Schema for Maintenance Log response."""
    id: UUID
    organization_id: UUID
    kit_item_id: UUID
    transaction_id: Optional[UUID] = None
    created_at: datetime


class KitItemMaintenanceHistory(BaseModel):
    """Schema for kit item maintenance history."""
    kit_item_id: UUID
    kit_item_name: str
    kit_item_category: str
    total_maintenance_cost_cents: int
    maintenance_count: int
    last_maintenance_date: Optional[date]
    health_status: HealthStatus
    maintenance_logs: List[MaintenanceLog] = []

    model_config = ConfigDict(from_attributes=True)


class InventoryHealthReport(BaseModel):
    """Schema for inventory health report."""
    organization_id: UUID
    total_items: int
    items_by_health: dict = {}  # {"excellent": 5, "good": 3, "needs_service": 2, "broken": 1}
    items_needing_maintenance: List[dict] = []  # Items overdue for maintenance
    items_over_usage_limit: List[dict] = []  # Items exceeding usage thresholds
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)