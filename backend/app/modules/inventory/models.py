from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base import Base


class Equipment(Base):
    """
    Equipment model for tracking production gear and assets.
    Covers cameras, lights, sound equipment, and other production tools.
    """
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)

    # Equipment classification
    category = Column(String(100), nullable=False, index=True)  # Camera, Lighting, Sound, Grip, etc.
    subcategory = Column(String(100), index=True)  # DSLR, LED Panel, Microphone, etc.

    # Identification
    serial_number = Column(String(100), unique=True, index=True)
    asset_tag = Column(String(50), unique=True, index=True)
    barcode = Column(String(100), unique=True)

    # Technical specifications (stored as JSON for flexibility)
    specifications = Column(JSON, default=dict)  # Resolution, wattage, frequency, etc.

    # Financial information
    purchase_price_cents = Column(Integer)  # Purchase price in cents
    currency = Column(String(3), default="BRL")
    depreciation_rate_percent = Column(Numeric(5, 2))  # Annual depreciation rate
    current_value_cents = Column(Integer)  # Current depreciated value

    # Ownership and vendor
    vendor_name = Column(String(255))
    vendor_contact = Column(String(255))
    warranty_expiration = Column(Date)

    # Status and availability
    status = Column(String(50), default="available")  # available, in_use, maintenance, retired, lost
    condition = Column(String(50), default="good")  # excellent, good, fair, poor, damaged

    # Location and assignment
    current_location = Column(String(255))  # Warehouse shelf, shooting location, etc.
    assigned_to_project = Column(String(100))  # Current project assignment
    assigned_to_user = Column(String, ForeignKey("users.id"))  # Current user assignment

    # Maintenance tracking
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_interval_days = Column(Integer)  # Days between maintenance

    # Usage tracking
    usage_hours = Column(Numeric(10, 2), default=0)  # Total usage hours
    usage_count = Column(Integer, default=0)  # Number of times used

    # Insurance and safety
    insured = Column(Boolean, default=False)
    insurance_policy = Column(String(100))
    safety_requirements = Column(Text)  # Special handling or safety notes

    # Digital assets (photos, manuals)
    photo_urls = Column(JSON, default=list)  # URLs to equipment photos
    manual_url = Column(String(500))  # URL to user manual
    documentation_urls = Column(JSON, default=list)  # Additional documentation

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    purchased_at = Column(Date)

    # Relationships
    maintenance_logs = relationship("MaintenanceLog", back_populates="equipment", cascade="all, delete-orphan")
    # Adicionamos foreign_keys explicitamente aqui
    kit_items = relationship("KitItem", back_populates="equipment", foreign_keys="[KitItem.equipment_id]")

    @property
    def purchase_price(self) -> Decimal:
        """Get purchase price in currency units."""
        return Decimal(self.purchase_price_cents or 0) / 100

    @property
    def current_value(self) -> Decimal:
        """Get current value in currency units."""
        return Decimal(self.current_value_cents or 0) / 100

    def calculate_current_value(self):
        """Calculate current depreciated value based on age and depreciation rate."""
        if not self.purchase_price_cents or not self.purchased_at or not self.depreciation_rate_percent:
            self.current_value_cents = self.purchase_price_cents
            return

        # Calculate age in years
        age_years = (date.today() - self.purchased_at).days / 365.25

        # Apply straight-line depreciation
        depreciation_factor = 1 - (self.depreciation_rate_percent / 100 * age_years)
        depreciation_factor = max(0, depreciation_factor)  # Don't go below 0

        self.current_value_cents = int(self.purchase_price_cents * depreciation_factor)

    def is_due_for_maintenance(self) -> bool:
        """Check if equipment is due for maintenance."""
        if not self.next_maintenance_date:
            return False
        return date.today() >= self.next_maintenance_date

    def is_overdue_for_maintenance(self) -> bool:
        """Check if equipment is overdue for maintenance."""
        if not self.next_maintenance_date:
            return False
        return date.today() > self.next_maintenance_date

    def update_usage(self, hours_used: float = 0, count_increment: int = 1):
        """Update usage statistics."""
        self.usage_hours = (self.usage_hours or 0) + hours_used
        self.usage_count = (self.usage_count or 0) + count_increment
        self.updated_at = func.now()

    def __repr__(self):
        return f"<Equipment(id={self.id}, name={self.name}, category={self.category}, status={self.status})>"


class Kit(Base):
    """
    Kit model for pre-configured equipment sets.
    Groups related equipment items for specific production needs.
    """
    __tablename__ = "kits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)

    # Kit classification
    category = Column(String(100), nullable=False, index=True)  # Basic Lighting, DSLR Package, Sound Kit, etc.
    kit_type = Column(String(50), default="standard")  # standard, backup, specialty

    # Usage and availability
    status = Column(String(50), default="available")  # available, in_use, maintenance, incomplete
    availability_status = Column(String(50), default="ready")  # ready, partial, unavailable

    # Capacity and requirements
    max_crew_size = Column(Integer)  # Maximum crew that can use this kit
    power_requirements = Column(Text)  # Power needs summary
    transportation_notes = Column(Text)  # Transport requirements

    # Cost information
    daily_rate_cents = Column(Integer)  # Daily rental rate in cents
    replacement_value_cents = Column(Integer)  # Total replacement value of all items

    # Quality and features
    quality_level = Column(String(50), default="standard")  # basic, standard, professional, premium
    special_features = Column(JSON, default=list)  # Special capabilities or features

    # Documentation
    setup_instructions = Column(Text)
    checklist_items = Column(JSON, default=list)  # Pre/post-use checklist

    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_date = Column(Date)
    average_setup_time_minutes = Column(Integer)

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    kit_items = relationship("KitItem", back_populates="kit", cascade="all, delete-orphan")

    @property
    def daily_rate(self) -> Decimal:
        """Get daily rate in currency units."""
        return Decimal(self.daily_rate_cents or 0) / 100

    @property
    def replacement_value(self) -> Decimal:
        """Get replacement value in currency units."""
        return Decimal(self.replacement_value_cents or 0) / 100

    def update_availability_status(self):
        """Update availability status based on kit items."""
        if not self.kit_items:
            self.availability_status = "empty"
            return

        available_count = sum(1 for item in self.kit_items if item.equipment.status == "available")
        total_count = len(self.kit_items)

        if available_count == total_count:
            self.availability_status = "ready"
        elif available_count > 0:
            self.availability_status = "partial"
        else:
            self.availability_status = "unavailable"

        # Update kit status accordingly
        if self.availability_status == "ready":
            self.status = "available"
        elif self.availability_status == "unavailable":
            self.status = "maintenance"
        else:
            self.status = "available"  # Partial availability still allows use

    def record_usage(self):
        """Record kit usage."""
        self.usage_count = (self.usage_count or 0) + 1
        self.last_used_date = date.today()
        self.updated_at = func.now()

    def __repr__(self):
        return f"<Kit(id={self.id}, name={self.name}, category={self.category}, status={self.status})>"


class KitItem(Base):
    """
    KitItem model linking equipment to kits with quantity and role information.
    """
    __tablename__ = "kit_items"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("kits.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)

    # Item details in kit
    quantity = Column(Integer, default=1)  # How many of this equipment in the kit
    role_in_kit = Column(String(100))  # Primary camera, key light, etc.
    is_required = Column(Boolean, default=True)  # Whether this item is required for kit completeness

    # Backup/alternative information
    backup_equipment_id = Column(Integer, ForeignKey("equipment.id"))  # Alternative equipment
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    kit = relationship("Kit", back_populates="kit_items")
    equipment = relationship("Equipment", back_populates="kit_items", foreign_keys=[equipment_id])
    backup_equipment = relationship("Equipment", foreign_keys=[backup_equipment_id])

    def is_available(self) -> bool:
        """Check if this kit item is available."""
        return self.equipment.status == "available"

    def __repr__(self):
        return f"<KitItem(id={self.id}, kit_id={self.kit_id}, equipment_id={self.equipment_id}, quantity={self.quantity})>"


class MaintenanceLog(Base):
    """
    MaintenanceLog model for tracking equipment maintenance, repairs, and inspections.
    """
    __tablename__ = "maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)

    # Maintenance details
    maintenance_type = Column(String(50), nullable=False)  # inspection, cleaning, repair, calibration, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    # Status and scheduling
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled
    priority = Column(String(50), default="normal")  # low, normal, high, urgent

    # Timing
    scheduled_date = Column(Date, nullable=False)
    completed_date = Column(Date)
    estimated_duration_hours = Column(Numeric(5, 2))
    actual_duration_hours = Column(Numeric(5, 2))

    # Cost information
    labor_cost_cents = Column(Integer, default=0)
    parts_cost_cents = Column(Integer, default=0)
    total_cost_cents = Column(Integer, default=0)

    # External service information
    service_provider = Column(String(255))  # Company that performed maintenance
    service_provider_contact = Column(String(255))
    warranty_applicable = Column(Boolean, default=False)

    # Results and findings
    findings = Column(Text)  # What was found during maintenance
    recommendations = Column(Text)  # Recommended actions
    next_maintenance_date = Column(Date)  # When next maintenance is due

    # Quality and outcome
    quality_rating = Column(Integer)  # 1-5 rating of maintenance quality
    equipment_condition_after = Column(String(50))  # Condition after maintenance

    # Documentation
    photos_before_urls = Column(JSON, default=list)
    photos_after_urls = Column(JSON, default=list)
    documents_urls = Column(JSON, default=list)  # Invoices, reports, etc.

    # Performed by
    performed_by_internal = Column(String, ForeignKey("users.id"))  # Internal technician
    performed_by_external = Column(String(255))  # External technician name
    approved_by = Column(String, ForeignKey("users.id"))  # Who approved the work

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    equipment = relationship("Equipment", back_populates="maintenance_logs")

    @property
    def labor_cost(self) -> Decimal:
        """Get labor cost in currency units."""
        return Decimal(self.labor_cost_cents or 0) / 100

    @property
    def parts_cost(self) -> Decimal:
        """Get parts cost in currency units."""
        return Decimal(self.parts_cost_cents or 0) / 100

    @property
    def total_cost(self) -> Decimal:
        """Get total cost in currency units."""
        return Decimal(self.total_cost_cents or 0) / 100

    def calculate_total_cost(self):
        """Calculate total maintenance cost."""
        self.total_cost_cents = (self.labor_cost_cents or 0) + (self.parts_cost_cents or 0)

    def is_overdue(self) -> bool:
        """Check if maintenance is overdue."""
        if self.status == "completed":
            return False
        return date.today() > self.scheduled_date

    def mark_completed(self, completed_date: date = None, actual_hours: float = None):
        """Mark maintenance as completed."""
        self.status = "completed"
        self.completed_date = completed_date or date.today()
        if actual_hours is not None:
            self.actual_duration_hours = actual_hours
        self.updated_at = func.now()

    def __repr__(self):
        return f"<MaintenanceLog(id={self.id}, equipment_id={self.equipment_id}, type={self.maintenance_type}, status={self.status})>"


# Equipment categories and subcategories
EQUIPMENT_CATEGORIES = {
    "CAMERA": ["DSLR", "MIRRORLESS", "CINEMA", "DOCUMENTARY", "ACTION", "DRONE"],
    "LIGHTING": ["LED_PANEL", "SOFTBOX", "SPOTLIGHT", "PRACTICAL", "HMIS", "FRESNEL"],
    "SOUND": ["MICROPHONE", "RECORDER", "MONITOR", "WIRELESS", "LAVALIER", "BOOM"],
    "GRIP": ["TRIPOD", "DOLLY", "SLIDER", "RIG", "STABILIZER", "CRANE"],
    "ELECTRICAL": ["GENERATOR", "DISTRIBUTION", "BATTERY", "CHARGER", "CABLE"],
    "PRODUCTION": ["MONITOR", "TELEPROMPTER", "SLATE", "CLAPPER", "VIEWFINDER"],
    "POST_PRODUCTION": ["LAPTOP", "HARD_DRIVE", "MEMORY_CARD", "DOCK", "CABLE"],
    "MISCELLANEOUS": ["TOOLKIT", "CASE", "ACCESSORY", "ADAPTER", "FILTER"]
}

# Status constants
EQUIPMENT_STATUSES = ["available", "in_use", "maintenance", "retired", "lost", "stolen"]
KIT_STATUSES = ["available", "in_use", "maintenance", "incomplete"]
MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"]
MAINTENANCE_TYPES = ["inspection", "cleaning", "repair", "calibration", "upgrade", "replacement", "preventive"]