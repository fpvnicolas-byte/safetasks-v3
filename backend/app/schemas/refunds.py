from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class RefundRequestCreate(BaseModel):
    purchase_id: UUID
    reason_code: str
    reason_detail: str

class RefundRequestResponse(BaseModel):
    id: UUID
    purchase_id: UUID
    status: str
    amount_paid_cents: int
    requested_at: datetime
    eligible_until: Optional[datetime]
    
    class Config:
        from_attributes = True

class RefundDetailResponse(RefundRequestResponse):
    consumed_usage_value_cents: int
    calculated_max_refund_cents: int
    approved_amount_cents: Optional[int]
    reason_detail: Optional[str]
    organization_id: UUID

class PlatformRefundAction(BaseModel):
    action: str  # approve, reject, confirm_execution
    approved_amount_cents: Optional[int] = None
    provider_refund_id: Optional[str] = None # required for confirm_execution
    reason: Optional[str] = None # required for reject
