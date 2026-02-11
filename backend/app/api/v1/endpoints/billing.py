"""Billing and InfinityPay webhook endpoints."""
import logging
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_current_profile, get_db, require_billing_read
from app.core.config import settings
from app.models.profiles import Profile
from app.models.billing import Plan
from app.schemas.billing import (
    BillingUsageResponse,
    EntitlementInfo,
    PlanInfo,
    SubscriptionInfo,
)
from app.services import billing as billing_service
from app.api.deps import get_organization_record
from app.services.infinity_pay import infinity_pay_service

logger = logging.getLogger(__name__)
router = APIRouter()


class CheckoutLinkRequest(BaseModel):
    """Request to create a checkout link."""
    plan_name: Literal["starter", "professional", "professional_annual"]
    redirect_url: str


class CheckoutLinkResponse(BaseModel):
    """Response with checkout URL."""
    url: str


@router.post("/webhooks/infinitypay")
async def infinitypay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Handle InfinityPay webhook events.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    logger.info(f"Received InfinityPay webhook: {payload}")
    
    # Process webhook (return 400 on failure so provider retries)
    processed = await billing_service.process_infinitypay_webhook(db, payload)
    if not processed:
        raise HTTPException(status_code=400, detail="Webhook payload could not be processed")

    return {"status": "success"}


class VerifyTransactionRequest(BaseModel):
    transaction_nsu: str
    order_nsu: str
    invoice_slug: Optional[str] = None
    slug: Optional[str] = None


@router.post("/verify")
async def verify_transaction_manually(
    request: VerifyTransactionRequest,
    db: AsyncSession = Depends(get_db),
    profile: Profile = Depends(get_current_profile)
) -> dict:
    """
    Manually trigger verification for a transaction (called by Frontend on success page).
    User must belong to the organization referenced in order_nsu.
    """
    invoice_slug = request.invoice_slug or request.slug
    if not invoice_slug:
        raise HTTPException(400, "Missing invoice slug")

    # Security: Ensure user owns the order
    # order_nsu format: orgId_plan_timestamp (legacy: orgId_timestamp)
    try:
        org_id_str = request.order_nsu.split("_")[0]
        order_org_id = UUID(org_id_str)
    except:
        raise HTTPException(400, "Invalid order_nsu format")

    if profile.organization_id != order_org_id:
        raise HTTPException(403, "You do not have permission to verify this order")

    # Reuse the logic from webhook via a simulated payload
    # Or better, extract a 'process_payment' method in service.
    # For now, let's construct a payload that matches what process_infinitypay_webhook expects
    # We need to fetch amount/details from the verification call first because frontend might lie.
    
    # 1. Verify with InfinityPay FIRST to get truth
    is_valid, data = await infinity_pay_service.verify_payment(
        transaction_id=request.transaction_nsu,
        order_nsu=request.order_nsu,
        slug=invoice_slug
    )
    
    if not is_valid:
         raise HTTPException(400, "Payment verification failed or invalid")
         
    # 2. Construct a properly-shaped payload from the TRUSTED verification response
    # The process_infinitypay_webhook expects specific top-level keys
    verified_payload = {
        "order_nsu": request.order_nsu,
        "transaction_nsu": request.transaction_nsu,
        "invoice_slug": invoice_slug,
        "amount": data.get("amount", 0),
        "paid_amount": data.get("paid_amount", data.get("amount", 0)),
        "plan_name": data.get("plan_name"),  # From checkout metadata if available
        "capture_method": data.get("capture_method"),
        "installments": data.get("installments"),
    }
    processed = await billing_service.process_infinitypay_webhook(db, verified_payload)
    if not processed:
        raise HTTPException(400, "Verification payload could not be processed")
    
    return {"status": "verified", "access_granted": True}


@router.post("/checkout/link", response_model=CheckoutLinkResponse, dependencies=[Depends(require_billing_read())])
async def create_checkout_link(
    request: CheckoutLinkRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> CheckoutLinkResponse:
    """
    Create an InfinityPay Checkout link for plan upgrade.
    """
    # Get organization
    organization = await get_organization_record(profile, db)

    # Create checkout link
    url = await billing_service.create_infinitypay_checkout_link(
        db=db,
        organization=organization,
        plan_name=request.plan_name,
        redirect_url=request.redirect_url
    )
    
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate checkout link")

    return CheckoutLinkResponse(url=url)


@router.get("/usage", response_model=BillingUsageResponse, dependencies=[Depends(require_billing_read())])
async def get_usage(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> BillingUsageResponse:
    """
    Get current organization usage and limits.
    """
    from app.services.entitlements import get_entitlement, _get_or_create_usage

    organization = await get_organization_record(profile, db)
    entitlement = await get_entitlement(db, organization)
    usage = await _get_or_create_usage(db, organization.id)

    plan_row = None
    plan_info = None
    plan_name = None
    if organization.plan_id:
        plan_result = await db.execute(select(Plan).where(Plan.id == organization.plan_id))
        plan_row = plan_result.scalar_one_or_none()
        if plan_row:
            plan_name = plan_row.name
            plan_info = _serialize_plan_info(plan_row, entitlement)

    # Mock subscription info for frontend compatibility if needed, 
    # or return None to indicate no recurring sub.
    subscription_info = None
    
    # Logic for trial/pre-paid status
    is_active = billing_service.has_active_access(organization)
    
    # Override billing_status if expired? 
    # The service currently relies on DB state.
    
    return BillingUsageResponse(
        organization_id=organization.id,
        plan_id=plan_row.id if plan_row else None,
        plan_name=plan_name,
        plan=plan_info,
        billing_status=organization.billing_status,
        subscription_status=organization.subscription_status,
        stripe_customer_id=organization.stripe_customer_id,
        stripe_subscription_id=organization.stripe_subscription_id,
        trial_ends_at=organization.trial_ends_at,
        usage={
            "projects": usage.projects_count,
            "clients": usage.clients_count,
            "proposals": usage.proposals_count,
            "users": usage.users_count,
            "storage_bytes": usage.storage_bytes_used,
            "ai_credits": usage.ai_credits_used,
        },
        limits={
            "projects": entitlement.max_projects if entitlement else None,
            "clients": entitlement.max_clients if entitlement else None,
            "proposals": entitlement.max_proposals if entitlement else None,
            "users": entitlement.max_users if entitlement else None,
            "storage_bytes": entitlement.max_storage_bytes if entitlement else None,
            "ai_credits": entitlement.ai_credits if entitlement else None,
        },
        subscription=subscription_info,
    )


# Removed: cancellation/resume/portal endpoints as they were Stripe-specific 
# and don't apply to one-off InfinityPay payments.


def _serialize_plan_info(plan: Plan, entitlement) -> PlanInfo:
    entitlements = None
    if entitlement:
        entitlements = EntitlementInfo(
            max_projects=entitlement.max_projects,
            max_clients=entitlement.max_clients,
            max_proposals=entitlement.max_proposals,
            max_users=entitlement.max_users,
            max_storage_bytes=entitlement.max_storage_bytes,
            ai_credits=entitlement.ai_credits,
        )

    return PlanInfo(
        id=plan.id,
        name=plan.name,
        billing_interval=plan.billing_interval,
        stripe_price_id=plan.stripe_price_id,
        entitlements=entitlements,
    )


def _timestamp_to_datetime(value: Optional[int]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)
