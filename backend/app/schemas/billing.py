from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel


class EntitlementInfo(BaseModel):
    max_projects: Optional[int]
    max_clients: Optional[int]
    max_proposals: Optional[int]
    max_users: Optional[int]
    max_storage_bytes: Optional[int]
    ai_credits: Optional[int]


class PlanInfo(BaseModel):
    id: UUID
    name: str
    billing_interval: Optional[str]
    stripe_price_id: Optional[str]
    entitlements: Optional[EntitlementInfo]


class SubscriptionInfo(BaseModel):
    id: str
    status: str
    cancel_at_period_end: bool
    canceled_at: Optional[datetime]
    cancel_at: Optional[datetime]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    price_id: Optional[str]
    plan_id: Optional[str]
    latest_invoice: Optional[str]


class UsageInfo(BaseModel):
    projects: int
    clients: int
    proposals: int
    users: int
    storage_bytes: int
    ai_credits: int


class LimitsInfo(BaseModel):
    projects: Optional[int]
    clients: Optional[int]
    proposals: Optional[int]
    users: Optional[int]
    storage_bytes: Optional[int]
    ai_credits: Optional[int]


class BillingUsageResponse(BaseModel):
    organization_id: UUID
    plan_id: Optional[UUID]
    plan_name: Optional[str]
    plan: Optional[PlanInfo]
    billing_status: Optional[str]
    subscription_status: Optional[str]
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]
    trial_ends_at: Optional[datetime]
    access_ends_at: Optional[datetime]
    days_until_access_end: Optional[int]
    usage: UsageInfo
    limits: LimitsInfo
    subscription: Optional[SubscriptionInfo]


class SubscriptionCancelRequest(BaseModel):
    at_period_end: bool = True


class SubscriptionActionResponse(BaseModel):
    subscription: SubscriptionInfo


class PortalSessionRequest(BaseModel):
    return_url: Optional[AnyHttpUrl] = None



class PortalSessionResponse(BaseModel):
    url: str


class BillingPurchaseResponse(BaseModel):
    id: UUID
    organization_id: UUID
    provider: str
    plan_name: Optional[str]
    amount_paid_cents: int
    currency: str
    paid_at: datetime
    total_refunded_cents: int
    created_at: datetime
    
    # We can add computed properties if needed, but client can compute check
    
    class Config:
        from_attributes = True

