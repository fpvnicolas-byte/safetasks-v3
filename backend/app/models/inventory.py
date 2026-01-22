from sqlalchemy import Column, String, TEXT, TIMESTAMP, func, ForeignKey, BIGINT, Float, Date, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid
import enum


class MaintenanceTypeEnum(enum.Enum):
    preventive = "preventive"
    corrective = "corrective"
    calibration = "calibration"
    inspection = "inspection"
    upgrade = "upgrade"


class HealthStatusEnum(enum.Enum):
    excellent = "excellent"
    good = "good"
    needs_service = "needs_service"
    broken = "broken"
    retired = "retired"


class KitItem(Base):
    __tablename__ = "kit_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    kit_id = Column(UUID(as_uuid=True), ForeignKey("kits.id"), nullable=False)

    name = Column(String, nullable=False)  # e.g., "DJI Mavic 3", "RED Komodo"
    description = Column(TEXT, nullable=True)
    category = Column(String, nullable=False)  # drone, camera, gimbal, battery, etc.

    # Maintenance tracking
    current_usage_hours = Column(Float, default=0.0)
    last_maintenance_date = Column(Date, nullable=True)
    health_status = Column(Enum(HealthStatusEnum), default=HealthStatusEnum.excellent)

    # Equipment details
    serial_number = Column(String, nullable=True)
    purchase_date = Column(Date, nullable=True)
    purchase_cost_cents = Column(BIGINT, nullable=True)
    warranty_expiry = Column(Date, nullable=True)

    # Maintenance thresholds (hours/days)
    maintenance_interval_hours = Column(Float, default=50.0)  # How often maintenance is needed
    max_usage_hours = Column(Float, default=1000.0)  # Expected lifespan

    notes = Column(TEXT, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    kit = relationship("Kit", back_populates="items")
    maintenance_logs = relationship("MaintenanceLog", back_populates="kit_item", cascade="all, delete-orphan")

    __table_args__ = (
        {'schema': None}
    )


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    kit_item_id = Column(UUID(as_uuid=True), ForeignKey("kit_items.id"), nullable=False)

    maintenance_type = Column(Enum(MaintenanceTypeEnum), nullable=False)
    description = Column(TEXT, nullable=False)
    technician_name = Column(String, nullable=True)

    # Financial impact
    cost_cents = Column(BIGINT, default=0)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)  # Link to financial transaction

    # Maintenance details
    date = Column(Date, nullable=False, server_default=func.current_date())
    duration_hours = Column(Float, nullable=True)  # How long the maintenance took

    # Before/after status
    health_before = Column(Enum(HealthStatusEnum), nullable=True)
    health_after = Column(Enum(HealthStatusEnum), nullable=True)

    # Usage reset (for preventive maintenance)
    usage_hours_reset = Column(Float, default=0.0)  # Reset usage counter after maintenance

    notes = Column(TEXT, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    kit_item = relationship("KitItem", back_populates="maintenance_logs")
    transaction = relationship("Transaction", back_populates="maintenance_logs")

    __table_args__ = (
        {'schema': None}
    )
