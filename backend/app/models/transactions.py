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
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)  # Link to who we paid/received from
    stakeholder_id = Column(UUID(as_uuid=True), ForeignKey("stakeholders.id", ondelete="SET NULL"), nullable=True)  # Link to specific team member
    budget_line_id = Column(UUID(as_uuid=True), ForeignKey("project_budget_lines.id"), nullable=True)  # Link to budget line
    category = Column(String, nullable=False)  # crew_hire, equipment_rental, logistics, post_production, other, production_revenue, maintenance
    type = Column(String, nullable=False)  # income, expense
    amount_cents = Column(BIGINT, nullable=False)
    description = Column(String)
    transaction_date = Column(DATE, server_default=func.current_date())
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Approval Workflow
    payment_status = Column(String, default="pending", nullable=False)  # pending, approved, paid, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)
    paid_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    paid_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    bank_account = relationship("BankAccount", back_populates="transactions")
    project = relationship("Project", back_populates="transactions")
    invoice = relationship("Invoice")
    supplier = relationship("Supplier", back_populates="transactions")
    stakeholder = relationship("Stakeholder", back_populates="transactions")
    budget_line = relationship("ProjectBudgetLine", back_populates="transactions")
    maintenance_logs = relationship("MaintenanceLog", back_populates="transaction")

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')"),
        CheckConstraint("category IN ('crew_hire', 'equipment_rental', 'logistics', 'post_production', 'other', 'production_revenue', 'maintenance', 'internal_transfer')"),
        CheckConstraint("payment_status IN ('pending', 'approved', 'paid', 'rejected')"),
    )
