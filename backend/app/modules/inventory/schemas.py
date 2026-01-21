from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.core.schemas import BaseSchema, CreateSchema, UpdateSchema


# Equipment Schemas
class EquipmentBase(BaseModel):
    """Base schema for equipment data."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None

    # Classification
    category: str = Field(..., max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)

    # Identification
    serial_number: Optional[str] = Field(None, max_length=100)
    asset_tag: Optional[str] = Field(None, max_length=50)
    barcode: Optional[str] = Field(None, max_length=100)

    # Technical specifications
    specifications: Dict[str, Any] = Field(default_factory=dict)

    # Financial information
    purchase_price: Optional[float] = Field(None, ge=0, description="Purchase price in currency units")
    currency: str = Field(default="BRL", max_length=3)
    depreciation_rate_percent: Optional[float] = Field(None, ge=0, le=100)

    # Ownership and vendor
    vendor_name: Optional[str] = Field(None, max_length=255)
    vendor_contact: Optional[str] = Field(None, max_length=255)
    warranty_expiration: Optional[date] = None

    # Status and availability
    status: str = Field(default="available", max_length=50)
    condition: str = Field(default="good", max_length=50)

    # Location and assignment
    current_location: Optional[str] = Field(None, max_length=255)
    assigned_to_project: Optional[str] = Field(None, max_length=100)

    # Maintenance tracking
    maintenance_interval_days: Optional[int] = Field(None, ge=0)

    # Insurance and safety
    insured: bool = False
    insurance_policy: Optional[str] = Field(None, max_length=100)
    safety_requirements: Optional[str] = None

    # Digital assets
    photo_urls: List[str] = Field(default_factory=list)
    manual_url: Optional[str] = Field(None, max_length=500)
    documentation_urls: List[str] = Field(default_factory=list)

    # Purchase date
    purchased_at: Optional[date] = None


class EquipmentCreate(EquipmentBase, CreateSchema):
    """Schema for creating new equipment."""
    pass


class EquipmentUpdate(EquipmentBase, UpdateSchema):
    """Schema for updating existing equipment."""
    pass


class EquipmentRead(BaseSchema):
    """Schema for reading equipment data."""
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: Optional[str]
    category: str
    subcategory: Optional[str]
    serial_number: Optional[str]
    asset_tag: Optional[str]
    barcode: Optional[str]
    specifications: Dict[str, Any]
    purchase_price: Optional[float]
    currency: str
    current_value: Optional[float]
    vendor_name: Optional[str]
    vendor_contact: Optional[str]
    warranty_expiration: Optional[date]
    status: str
    condition: str
    current_location: Optional[str]
    assigned_to_project: Optional[str]
    assigned_to_user: Optional[str]
    last_maintenance_date: Optional[date]
    next_maintenance_date: Optional[date]
    maintenance_interval_days: Optional[int]
    usage_hours: Optional[float]
    usage_count: Optional[int]
    insured: bool
    insurance_policy: Optional[str]
    safety_requirements: Optional[str]
    photo_urls: List[str]
    manual_url: Optional[str]
    documentation_urls: List[str]
    purchased_at: Optional[date]

    # Computed fields
    is_due_for_maintenance: bool = False
    is_overdue_for_maintenance: bool = False


# Kit Schemas
class KitBase(BaseModel):
    """Base schema for kit data."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None

    # Classification
    category: str = Field(..., max_length=100)
    kit_type: str = Field(default="standard", max_length=50)

    # Capacity and requirements
    max_crew_size: Optional[int] = Field(None, ge=1)
    power_requirements: Optional[str] = None
    transportation_notes: Optional[str] = None

    # Cost information
    daily_rate: Optional[float] = Field(None, ge=0, description="Daily rental rate in currency units")

    # Quality and features
    quality_level: str = Field(default="standard", max_length=50)
    special_features: List[str] = Field(default_factory=list)

    # Documentation
    setup_instructions: Optional[str] = None
    checklist_items: List[str] = Field(default_factory=list)


class KitCreate(KitBase, CreateSchema):
    """Schema for creating a new kit."""
    equipment_ids: List[int] = Field(..., description="List of equipment IDs to include in kit")


class KitUpdate(KitBase, UpdateSchema):
    """Schema for updating an existing kit."""
    pass


class KitRead(BaseSchema):
    """Schema for reading kit data."""
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: Optional[str]
    category: str
    kit_type: str
    status: str
    availability_status: str
    max_crew_size: Optional[int]
    power_requirements: Optional[str]
    transportation_notes: Optional[str]
    daily_rate: Optional[float]
    replacement_value: Optional[float]
    quality_level: str
    special_features: List[str]
    setup_instructions: Optional[str]
    checklist_items: List[str]
    usage_count: Optional[int]
    last_used_date: Optional[date]
    average_setup_time_minutes: Optional[int]


class KitItemBase(BaseModel):
    """Base schema for kit item data."""
    equipment_id: int
    quantity: int = Field(default=1, ge=1)
    role_in_kit: Optional[str] = Field(None, max_length=100)
    is_required: bool = True
    backup_equipment_id: Optional[int] = None
    notes: Optional[str] = None


class KitItemCreate(KitItemBase, CreateSchema):
    """Schema for creating a new kit item."""
    kit_id: int


class KitItemUpdate(KitItemBase, UpdateSchema):
    """Schema for updating an existing kit item."""
    pass


class KitItemRead(BaseSchema):
    """Schema for reading kit item data."""
    model_config = ConfigDict(from_attributes=True)

    kit_id: int
    equipment_id: int
    quantity: int
    role_in_kit: Optional[str]
    is_required: bool
    backup_equipment_id: Optional[int]
    notes: Optional[str]

    # Related data
    equipment: Optional[Dict[str, Any]] = None
    backup_equipment: Optional[Dict[str, Any]] = None


class KitWithItems(BaseModel):
    """Schema for kit with all its items."""
    kit: KitRead
    items: List[KitItemRead]
    total_items: int
    available_items: int
    required_items_available: int


# Maintenance Schemas
class MaintenanceLogBase(BaseModel):
    """Base schema for maintenance log data."""
    maintenance_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=255)
    description: str = Field(...)

    # Status and scheduling
    priority: str = Field(default="normal", max_length=50)

    # Timing
    scheduled_date: date
    estimated_duration_hours: Optional[float] = Field(None, ge=0)

    # Cost information
    labor_cost: float = Field(default=0.0, ge=0, description="Labor cost in currency units")
    parts_cost: float = Field(default=0.0, ge=0, description="Parts cost in currency units")

    # External service information
    service_provider: Optional[str] = Field(None, max_length=255)
    service_provider_contact: Optional[str] = Field(None, max_length=255)
    warranty_applicable: bool = False

    # Results and findings
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    next_maintenance_date: Optional[date] = None

    # Quality and outcome
    quality_rating: Optional[int] = Field(None, ge=1, le=5)
    equipment_condition_after: Optional[str] = Field(None, max_length=50)

    # Documentation
    photos_before_urls: List[str] = Field(default_factory=list)
    photos_after_urls: List[str] = Field(default_factory=list)
    documents_urls: List[str] = Field(default_factory=list)

    # Performed by
    performed_by_external: Optional[str] = Field(None, max_length=255)


class MaintenanceLogCreate(MaintenanceLogBase, CreateSchema):
    """Schema for creating a new maintenance log."""
    equipment_id: int


class MaintenanceLogUpdate(MaintenanceLogBase, UpdateSchema):
    """Schema for updating an existing maintenance log."""
    status: Optional[str] = None
    completed_date: Optional[date] = None
    actual_duration_hours: Optional[float] = None


class MaintenanceLogRead(BaseSchema):
    """Schema for reading maintenance log data."""
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int
    maintenance_type: str
    title: str
    description: str
    status: str
    priority: str
    scheduled_date: date
    completed_date: Optional[date]
    estimated_duration_hours: Optional[float]
    actual_duration_hours: Optional[float]
    labor_cost: float
    parts_cost: float
    total_cost: float
    service_provider: Optional[str]
    service_provider_contact: Optional[str]
    warranty_applicable: bool
    findings: Optional[str]
    recommendations: Optional[str]
    next_maintenance_date: Optional[date]
    quality_rating: Optional[int]
    equipment_condition_after: Optional[str]
    photos_before_urls: List[str]
    photos_after_urls: List[str]
    documents_urls: List[str]
    performed_by_internal: Optional[str]
    performed_by_external: Optional[str]
    approved_by: Optional[str]

    # Related data
    equipment: Optional[Dict[str, Any]] = None


# API Request/Response Schemas
class EquipmentAssignmentRequest(BaseModel):
    """Schema for equipment assignment requests."""
    equipment_id: int
    assigned_to_user: Optional[str] = None
    assigned_to_project: Optional[str] = None
    location: Optional[str] = None
    usage_hours: float = Field(default=0.0, ge=0)


class KitAssemblyRequest(BaseModel):
    """Schema for kit assembly requests."""
    kit_id: int
    equipment_ids: List[int] = Field(..., description="Equipment IDs to add to kit")
    roles: Optional[Dict[int, str]] = Field(None, description="Equipment ID -> role mapping")


class EquipmentSearchRequest(BaseModel):
    """Schema for equipment search requests."""
    category: Optional[str] = None
    subcategory: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    available_only: bool = False
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class MaintenanceScheduleRequest(BaseModel):
    """Schema for maintenance scheduling requests."""
    equipment_ids: List[int] = Field(..., description="Equipment IDs to schedule maintenance for")
    maintenance_type: str = Field(..., description="Type of maintenance")
    scheduled_date: date
    priority: str = Field(default="normal")
    estimated_duration_hours: Optional[float] = None


class EquipmentBulkUpdateRequest(BaseModel):
    """Schema for bulk equipment updates."""
    equipment_ids: List[int] = Field(..., description="Equipment IDs to update")
    updates: Dict[str, Any] = Field(..., description="Fields to update")


# Filter Schemas
class EquipmentFilter(BaseModel):
    """Filter parameters for equipment queries."""
    category: Optional[str] = None
    subcategory: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    assigned_to_user: Optional[str] = None
    assigned_to_project: Optional[str] = None
    is_due_maintenance: Optional[bool] = None
    is_overdue_maintenance: Optional[bool] = None


class KitFilter(BaseModel):
    """Filter parameters for kit queries."""
    category: Optional[str] = None
    kit_type: Optional[str] = None
    status: Optional[str] = None
    availability_status: Optional[str] = None
    quality_level: Optional[str] = None


class MaintenanceLogFilter(BaseModel):
    """Filter parameters for maintenance log queries."""
    equipment_id: Optional[int] = None
    maintenance_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scheduled_from: Optional[date] = None
    scheduled_to: Optional[date] = None
    is_overdue: Optional[bool] = None


# Report Schemas
class EquipmentInventoryReport(BaseModel):
    """Schema for equipment inventory reports."""
    total_equipment: int
    by_category: Dict[str, int]
    by_status: Dict[str, int]
    by_condition: Dict[str, int]
    total_value: float
    depreciated_value: float
    maintenance_due: int
    maintenance_overdue: int


class KitUtilizationReport(BaseModel):
    """Schema for kit utilization reports."""
    total_kits: int
    by_category: Dict[str, int]
    by_status: Dict[str, int]
    utilization_rate: float
    average_daily_rate: float
    most_used_kits: List[Dict[str, Any]]


class MaintenanceReport(BaseModel):
    """Schema for maintenance reports."""
    total_maintenance_logs: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]
    total_cost: float
    average_cost_per_equipment: float
    overdue_maintenance: int
    upcoming_maintenance: int


# Dashboard Schemas
class InventoryDashboard(BaseModel):
    """Schema for inventory dashboard data."""
    equipment_stats: EquipmentInventoryReport
    kit_stats: KitUtilizationReport
    maintenance_stats: MaintenanceReport
    alerts: List[Dict[str, Any]] = Field(default_factory=list)
    recent_activity: List[Dict[str, Any]] = Field(default_factory=list)