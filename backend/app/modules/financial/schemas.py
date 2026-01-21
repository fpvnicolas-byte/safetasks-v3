from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

from app.core.schemas import BaseSchema, CreateSchema, UpdateSchema


# Bank Account Schemas
class BankAccountBase(BaseModel):
    """Base schema for bank account data."""
    name: str = Field(..., max_length=255)
    account_number: str = Field(..., max_length=50)
    agency: str = Field(..., max_length=20)
    bank_code: str = Field(..., max_length=10, description="Código do banco")

    account_type: str = Field(default="checking", max_length=50)
    is_active: bool = True
    is_reconciled: bool = True


class BankAccountCreate(BankAccountBase, CreateSchema):
    """Schema for creating a new bank account."""
    pass


class BankAccountUpdate(BankAccountBase, UpdateSchema):
    """Schema for updating an existing bank account."""
    current_balance_cents: Optional[int] = None
    available_balance_cents: Optional[int] = None


class BankAccountRead(BankAccountBase, BaseSchema):
    """Schema for reading bank account data."""
    model_config = ConfigDict(from_attributes=True)

    current_balance: float
    available_balance: float
    last_reconciled_at: Optional[datetime]


# Transaction Schemas
class TransactionBase(BaseModel):
    """Base schema for transaction data."""
    description: str = Field(..., max_length=500)
    transaction_type: str = Field(..., max_length=50)  # income, expense, transfer
    category: str = Field(..., max_length=100)

    amount: float = Field(..., gt=0, description="Amount in currency units")
    currency: str = Field(default="BRL", max_length=3)

    bank_account_id: int
    transaction_date: date
    due_date: Optional[date] = None

    payment_method: Optional[str] = Field(None, max_length=50)
    payment_reference: Optional[str] = Field(None, max_length=100)
    party_name: Optional[str] = Field(None, max_length=255)
    party_tax_id: Optional[str] = Field(None, max_length=20)

    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class TransactionCreate(TransactionBase, CreateSchema):
    """Schema for creating a new transaction."""
    pass


class TransactionUpdate(TransactionBase, UpdateSchema):
    """Schema for updating an existing transaction."""
    status: Optional[str] = None
    payment_date: Optional[date] = None
    is_reconciled: Optional[bool] = None


class TransactionRead(BaseSchema):
    """Schema for reading transaction data."""
    model_config = ConfigDict(from_attributes=True)

    description: str
    transaction_type: str
    category: str

    amount: float
    tax_amount: float
    net_amount: float
    currency: str

    bank_account_id: int
    transaction_date: date
    due_date: Optional[date]
    payment_date: Optional[date]

    status: str
    is_reconciled: bool
    reconciliation_reference: Optional[str]

    payment_method: Optional[str]
    payment_reference: Optional[str]
    party_name: Optional[str]
    party_tax_id: Optional[str]

    tags: List[str]
    notes: Optional[str]


# Invoice Schemas
class InvoiceItem(BaseModel):
    """Schema for invoice items."""
    name: str = Field(..., description="Product/service name")
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total_price: float = Field(..., ge=0)
    tax_rate: float = Field(default=0.0, ge=0, le=1)
    ncm: Optional[str] = Field(None, max_length=20, description="NCM code")
    cfop: Optional[str] = Field(None, max_length=10, description="CFOP code")


class InvoiceBase(BaseModel):
    """Base schema for invoice data."""
    invoice_number: Optional[str] = Field(None, max_length=50)
    series: str = Field(default="1", max_length=10)
    invoice_type: str = Field(default="NFE", max_length=20)
    invoice_model: str = Field(default="55", max_length=5)

    # Parties
    issuer_tax_id: str = Field(..., max_length=20, description="CNPJ do emitente")
    issuer_name: str = Field(..., max_length=255)

    recipient_tax_id: str = Field(..., max_length=20, description="CNPJ/CPF do destinatário")
    recipient_name: str = Field(..., max_length=255)

    # Financial data
    total_amount: float = Field(..., ge=0)
    discount_amount: float = Field(default=0.0, ge=0)

    # Invoice items
    items: List[InvoiceItem] = Field(default_factory=list)

    # Fiscal information
    cfop: Optional[str] = Field(None, max_length=10, description="Código Fiscal de Operações")
    ncm: Optional[str] = Field(None, max_length=20, description="Nomenclatura Comum do Mercosul")
    operation_nature: Optional[str] = Field(None, max_length=120, description="Natureza da operação")

    # Additional information
    additional_info: Optional[str] = None
    complementary_info: Optional[str] = None


class InvoiceCreate(InvoiceBase, CreateSchema):
    """Schema for creating a new invoice."""
    pass


class InvoiceUpdate(InvoiceBase, UpdateSchema):
    """Schema for updating an existing invoice."""
    status: Optional[str] = None


class InvoiceRead(BaseSchema):
    """Schema for reading invoice data."""
    model_config = ConfigDict(from_attributes=True)

    invoice_number: Optional[str]
    series: str
    access_key: Optional[str]
    invoice_type: str
    invoice_model: str

    issuer_tax_id: str
    issuer_name: str
    recipient_tax_id: str
    recipient_name: str

    total_amount: float
    tax_amount: float
    discount_amount: float
    net_amount: float

    items: List[Dict[str, Any]]
    status: str
    authorization_protocol: Optional[str]
    authorization_date: Optional[datetime]

    provider_id: Optional[str]
    provider_status: Optional[str]

    xml_url: Optional[str]
    pdf_url: Optional[str]
    danfe_url: Optional[str]

    cancellation_reason: Optional[str]
    cancellation_protocol: Optional[str]
    cancellation_date: Optional[datetime]

    cfop: Optional[str]
    ncm: Optional[str]
    operation_nature: Optional[str]

    additional_info: Optional[str]
    complementary_info: Optional[str]


# API Request/Response Schemas
class TransactionReconciliationRequest(BaseModel):
    """Schema for transaction reconciliation requests."""
    transaction_ids: List[int] = Field(..., description="Transaction IDs to reconcile")
    account_id: int = Field(..., description="Bank account ID")


class InvoiceCancellationRequest(BaseModel):
    """Schema for invoice cancellation requests."""
    reason: str = Field(..., description="Cancellation reason")


# Filter Schemas
class BankAccountFilter(BaseModel):
    """Filter parameters for bank account queries."""
    is_active: Optional[bool] = True
    account_type: Optional[str] = None


class TransactionFilter(BaseModel):
    """Filter parameters for transaction queries."""
    bank_account_id: Optional[int] = None
    transaction_type: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_reconciled: Optional[bool] = None


class InvoiceFilter(BaseModel):
    """Filter parameters for invoice queries."""
    status: Optional[str] = None
    issuer_tax_id: Optional[str] = None
    recipient_tax_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


# Report Schemas
class CashFlowSummary(BaseModel):
    """Schema for cash flow summaries."""
    period: Dict[str, date]
    income: Dict[str, Any]
    expenses: Dict[str, Any]
    net_cash_flow: float
    account_id: Optional[int]


class TransactionCategoryReport(BaseModel):
    """Schema for transaction category reports."""
    categories: Dict[str, Dict[str, Any]]
    total_amount: float
    period: Optional[Dict[str, date]]


class InvoiceReport(BaseModel):
    """Schema for invoice reports."""
    period: Dict[str, date]
    by_status: Dict[str, Dict[str, Any]]
    totals: Dict[str, Any]
    issuer_tax_id: Optional[str]


# Dashboard Schemas
class FinancialDashboard(BaseModel):
    """Schema for financial dashboard data."""
    total_accounts: int
    total_balance: float
    recent_transactions: List[TransactionRead]
    overdue_transactions: List[TransactionRead]
    monthly_cash_flow: CashFlowSummary
    top_expense_categories: Dict[str, float]
    invoice_status_summary: Dict[str, int]


class InvoiceDashboard(BaseModel):
    """Schema for invoice dashboard data."""
    total_invoices: int
    authorized_invoices: int
    pending_invoices: int
    cancelled_invoices: int
    monthly_invoice_volume: Dict[str, int]
    top_recipients: List[Dict[str, Any]]
    recent_invoices: List[InvoiceRead]