from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base import Base


class BankAccount(Base):
    """
    BankAccount model for managing financial institution accounts.
    Used for reconciliation and cash flow tracking.
    """
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    account_number = Column(String(50), nullable=False)
    agency = Column(String(20), nullable=False)
    bank_code = Column(String(10), nullable=False)  # Código do banco (e.g., "001" for Banco do Brasil)

    # Account type
    account_type = Column(String(50), default="checking")  # checking, savings, etc.

    # Balance tracking (in cents)
    current_balance_cents = Column(Integer, default=0)
    available_balance_cents = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)
    is_reconciled = Column(Boolean, default=True)

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_reconciled_at = Column(DateTime(timezone=True))

    # Relationships
    transactions = relationship("Transaction", back_populates="bank_account")

    @property
    def current_balance(self) -> Decimal:
        """Get current balance in currency units."""
        return Decimal(self.current_balance_cents) / 100

    @property
    def available_balance(self) -> Decimal:
        """Get available balance in currency units."""
        return Decimal(self.available_balance_cents) / 100

    def update_balance(self, amount_cents: int):
        """Update account balance by adding/subtracting amount."""
        self.current_balance_cents += amount_cents
        self.available_balance_cents += amount_cents
        self.updated_at = func.now()

    def __repr__(self):
        return f"<BankAccount(id={self.id}, name={self.name}, balance={self.current_balance})>"


class Transaction(Base):
    """
    Transaction model for tracking all financial movements.
    Supports incomes, expenses, and transfers between accounts.
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # Transaction details
    description = Column(String(500), nullable=False)
    transaction_type = Column(String(50), nullable=False, index=True)  # income, expense, transfer
    category = Column(String(100), nullable=False, index=True)  # salaries, equipment, travel, etc.

    # Amounts (stored in cents)
    amount_cents = Column(Integer, nullable=False)
    tax_amount_cents = Column(Integer, default=0)  # Impostos calculados
    net_amount_cents = Column(Integer, nullable=False)  # Valor líquido

    # Currency
    currency = Column(String(3), default="BRL")

    # Account relationships
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    bank_account = relationship("BankAccount", back_populates="transactions")

    # Related entities (optional)
    budget_id = Column(Integer, ForeignKey("budgets.id"))  # From commercial module
    invoice_id = Column(Integer, ForeignKey("invoices.id"))  # Related invoice
    project_id = Column(Integer)  # Future project linking

    # Transaction metadata
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    due_date = Column(DateTime(timezone=True))  # For payable/receivable
    payment_date = Column(DateTime(timezone=True))  # When actually paid/received

    # Status and reconciliation
    status = Column(String(50), default="pending")  # pending, completed, cancelled, failed
    is_reconciled = Column(Boolean, default=False)
    reconciliation_reference = Column(String(100))  # Bank statement reference

    # Payment method and details
    payment_method = Column(String(50))  # cash, transfer, check, credit_card, etc.
    payment_reference = Column(String(100))  # Check number, transfer ID, etc.

    # Party information (who paid/received)
    party_name = Column(String(255))  # Client, supplier, employee name
    party_tax_id = Column(String(20))  # CPF/CNPJ of the party
    party_account_info = Column(JSON, default=dict)  # Bank details for transfers

    # Additional metadata
    tags = Column(JSON, default=list)  # Flexible tagging system
    notes = Column(Text)

    # Audit
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="transactions")

    @property
    def amount(self) -> Decimal:
        """Get transaction amount in currency units."""
        return Decimal(self.amount_cents) / 100

    @property
    def tax_amount(self) -> Decimal:
        """Get tax amount in currency units."""
        return Decimal(self.tax_amount_cents) / 100

    @property
    def net_amount(self) -> Decimal:
        """Get net amount in currency units."""
        return Decimal(self.net_amount_cents) / 100

    def calculate_net_amount(self):
        """Calculate net amount based on transaction type."""
        if self.transaction_type == "income":
            self.net_amount_cents = self.amount_cents - self.tax_amount_cents
        elif self.transaction_type == "expense":
            self.net_amount_cents = self.amount_cents + self.tax_amount_cents
        else:  # transfer
            self.net_amount_cents = self.amount_cents

    def is_overdue(self) -> bool:
        """Check if transaction is overdue."""
        if self.due_date and self.status == "pending":
            return self.due_date < func.now()
        return False

    def __repr__(self):
        return f"<Transaction(id={self.id}, type={self.transaction_type}, amount={self.amount}, status={self.status})>"


class Invoice(Base):
    """
    Invoice model representing NF-e (Nota Fiscal Eletrônica).
    Internal representation of fiscal documents with external provider integration.
    """
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    # Invoice identification
    invoice_number = Column(String(50), unique=True, index=True)  # Número da NF-e
    series = Column(String(10), default="1")  # Série da NF-e
    access_key = Column(String(44), unique=True, index=True)  # Chave de acesso da NF-e

    # Invoice type and model
    invoice_type = Column(String(20), default="NFE")  # NFE, NFCE, NFSE, etc.
    invoice_model = Column(String(5), default="55")  # Modelo: 55=NFE, 65=NFCE

    # Parties
    issuer_tax_id = Column(String(20), nullable=False, index=True)  # CNPJ do emitente
    issuer_name = Column(String(255), nullable=False)

    recipient_tax_id = Column(String(20), nullable=False, index=True)  # CNPJ/CPF do destinatário
    recipient_name = Column(String(255), nullable=False)

    # Financial data (in cents)
    total_amount_cents = Column(Integer, nullable=False)
    tax_amount_cents = Column(Integer, default=0)
    discount_amount_cents = Column(Integer, default=0)
    net_amount_cents = Column(Integer, nullable=False)

    # Invoice items (JSON array of products/services)
    items = Column(JSON, default=list)

    # Fiscal status
    status = Column(String(50), default="draft")  # draft, authorized, cancelled, rejected
    authorization_protocol = Column(String(50))  # Protocolo de autorização
    authorization_date = Column(DateTime(timezone=True))

    # External provider data
    provider_id = Column(String(100))  # ID in external fiscal provider
    provider_status = Column(String(50))  # Status from provider API
    provider_response = Column(JSON, default=dict)  # Full response from provider

    # Files
    xml_url = Column(String(500))  # Supabase Storage URL for XML
    pdf_url = Column(String(500))  # Supabase Storage URL for PDF
    danfe_url = Column(String(500))  # DANFE PDF URL

    # Cancellation data (if cancelled)
    cancellation_reason = Column(Text)
    cancellation_protocol = Column(String(50))
    cancellation_date = Column(DateTime(timezone=True))

    # Additional fiscal data
    cfop = Column(String(10))  # Código Fiscal de Operações
    ncm = Column(String(20))  # Nomenclatura Comum do Mercosul
    icms_cst = Column(String(5))  # Código de Situação Tributária do ICMS
    ipi_cst = Column(String(5))  # Código de Situação Tributária do IPI
    pis_cst = Column(String(5))  # Código de Situação Tributária do PIS
    cofins_cst = Column(String(5))  # Código de Situação Tributária do COFINS

    # Nature of operation
    operation_nature = Column(String(120))

    # Transportation data (for physical goods)
    transportation_data = Column(JSON, default=dict)

    # Payment information
    payment_info = Column(JSON, default=dict)

    # Additional information
    additional_info = Column(Text)
    complementary_info = Column(Text)

    # Audit
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    issued_at = Column(DateTime(timezone=True))

    # Relationships
    transactions = relationship("Transaction", back_populates="invoice")

    @property
    def total_amount(self) -> Decimal:
        """Get total amount in currency units."""
        return Decimal(self.total_amount_cents) / 100

    @property
    def tax_amount(self) -> Decimal:
        """Get tax amount in currency units."""
        return Decimal(self.tax_amount_cents) / 100

    @property
    def discount_amount(self) -> Decimal:
        """Get discount amount in currency units."""
        return Decimal(self.discount_amount_cents) / 100

    @property
    def net_amount(self) -> Decimal:
        """Get net amount in currency units."""
        return Decimal(self.net_amount_cents) / 100

    def can_be_cancelled(self) -> bool:
        """Check if invoice can be cancelled."""
        return self.status in ["authorized", "issued"] and not self.cancellation_date

    def is_authorized(self) -> bool:
        """Check if invoice is authorized."""
        return self.status == "authorized" and self.authorization_protocol is not None

    def __repr__(self):
        return f"<Invoice(id={self.id}, number={self.invoice_number}, status={self.status}, total={self.total_amount})>"


# Transaction categories (Brazilian standard)
TRANSACTION_CATEGORIES = {
    "OPERATIONAL": [
        "salaries", "rent", "utilities", "office_supplies", "communication",
        "transportation", "meals", "accommodation", "insurance", "software"
    ],
    "PRODUCTION": [
        "equipment_rental", "location_fees", "crew_payment", "post_production",
        "talent_fees", "music_licensing", "stock_footage", "visual_effects"
    ],
    "MARKETING": [
        "advertising", "promotional_materials", "events", "public_relations",
        "website_hosting", "social_media", "market_research"
    ],
    "ADMINISTRATIVE": [
        "legal_fees", "accounting", "audit", "consulting", "training",
        "certifications", "licenses", "permits"
    ],
    "CAPITAL": [
        "equipment_purchase", "software_purchase", "furniture", "renovations",
        "vehicles", "property_purchase"
    ],
    "FINANCIAL": [
        "interest_income", "interest_expense", "bank_fees", "currency_exchange",
        "loans", "investments"
    ],
    "TAXES": [
        "income_tax", "social_security", "pis_cofins", "icms", "iss", "irrf"
    ]
}

# Invoice statuses
INVOICE_STATUSES = ["draft", "processing", "authorized", "issued", "cancelled", "rejected"]

# Transaction statuses
TRANSACTION_STATUSES = ["pending", "completed", "cancelled", "failed", "reconciled"]