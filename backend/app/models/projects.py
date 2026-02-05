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

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'pre-production', 'production', 'post-production', 'delivered', 'archived')"),
        CheckConstraint("budget_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'increment_pending')"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String)
    status = Column(String, default="draft")  # draft, pre-production, production, post-production, delivered, archived

    # Financial tracking (money stored as cents for precision)
    budget_total_cents = Column(BIGINT, default=0, nullable=False)  # Total project budget in cents
    
    # Budget Approval Workflow
    budget_status = Column(String, default="draft", nullable=False)  # draft, pending_approval, approved, rejected, increment_pending
    budget_approved_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    budget_approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    budget_notes = Column(String, nullable=True)  # Notes from approver
    
    # Budget Increment Request Fields
    budget_increment_requested_cents = Column(BIGINT, default=0, nullable=False)  # Requested increment amount
    budget_increment_notes = Column(String, nullable=True)  # Notes for increment request
    budget_increment_requested_at = Column(TIMESTAMP(timezone=True), nullable=True)
    budget_increment_requested_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)

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
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    shooting_days = relationship("ShootingDay", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)

    # Relationships to financial entities
    invoices = relationship("Invoice", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    transactions = relationship("Transaction", back_populates="project", passive_deletes=True)
    budget_lines = relationship("ProjectBudgetLine", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)

    # Many-to-Many relationship with Service
    services = relationship("Service", secondary="project_services", backref="projects")


from sqlalchemy import Table

# Association table for Project <-> Service
project_services = Table(
    "project_services",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id"), primary_key=True),
)


