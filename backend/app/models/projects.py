from sqlalchemy import Column, String, TIMESTAMP, DATE, Boolean, BIGINT, func, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class Project(Base):
    """
    Video Production Project model.

    Represents a client project with budget tracking, status workflow, and production planning.
    """
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String)
    status = Column(String, default="draft")  # draft, pre-production, production, post-production, delivered, archived

    # Financial tracking (money stored as cents for precision)
    budget_total_cents = Column(BIGINT, default=0, nullable=False)  # Total project budget in cents

    # Timeline
    start_date = Column(DATE)
    end_date = Column(DATE)

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="projects")
    call_sheets = relationship("CallSheet", back_populates="project", cascade="all, delete-orphan")

    # Relationships to production entities
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    shooting_days = relationship("ShootingDay", back_populates="project", cascade="all, delete-orphan")

    # Relationships to financial entities
    invoices = relationship("Invoice", back_populates="project", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="project")

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'pre-production', 'production', 'post-production', 'delivered', 'archived')"),
    )
