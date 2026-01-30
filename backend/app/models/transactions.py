from sqlalchemy import Column, String, BIGINT, TIMESTAMP, DATE, func, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)  # Link to who we paid/received from
    stakeholder_id = Column(UUID(as_uuid=True), ForeignKey("stakeholders.id"), nullable=True)  # Link to specific team member
    category = Column(String, nullable=False)  # crew_hire, equipment_rental, logistics, post_production, other, production_revenue, maintenance
    type = Column(String, nullable=False)  # income, expense
    amount_cents = Column(BIGINT, nullable=False)
    description = Column(String)
    transaction_date = Column(DATE, server_default=func.current_date())
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    bank_account = relationship("BankAccount", back_populates="transactions")
    project = relationship("Project", back_populates="transactions")
    supplier = relationship("Supplier", back_populates="transactions")
    stakeholder = relationship("Stakeholder", back_populates="transactions")
    maintenance_logs = relationship("MaintenanceLog", back_populates="transaction")

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')"),
        CheckConstraint("category IN ('crew_hire', 'equipment_rental', 'logistics', 'post_production', 'other', 'production_revenue', 'maintenance')"),
    )
