"""Billing and Stripe webhook endpoints."""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

import stripe
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
    PortalSessionRequest,
    PortalSessionResponse,
    SubscriptionActionResponse,
    SubscriptionCancelRequest,
    SubscriptionInfo,
)
from app.services import billing as billing_service
from app.api.deps import get_organization_record

logger = logging.getLogger(__name__)
router = APIRouter()


class CheckoutSessionRequest(BaseModel):
    """Request to create a checkout session."""
    price_id: str
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    """Response with checkout session URL."""
    url: str


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe and processes them to update
    organization billing status, subscriptions, and payment information.

    Security: Verifies webhook signature using STRIPE_WEBHOOK_SECRET.
    Idempotency: Checks BillingEvent table to prevent duplicate processing.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header"
        )

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured"
        )

    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        logger.error("Invalid webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )

    event_id = event["id"]
    event_type = event["type"]
    event_data = event["data"]

    logger.info(f"Received webhook event: {event_type} ({event_id})")

    # Check idempotency - already processed?
    if await billing_service.is_event_processed(db, event_id):
        logger.info(f"Event {event_id} already processed, skipping")
        return {"status": "success", "message": "Event already processed"}

    # Record event as received
    billing_event = await billing_service.record_billing_event(
        db, event_id, event_type, "received"
    )

    try:
        # Process event based on type
        handler = billing_service.EVENT_HANDLERS.get(event_type)
        if handler:
            await handler(db, event_data)
            await billing_service.mark_event_processed(db, billing_event)
            await db.commit()
            logger.info(f"Successfully processed event {event_id}")
        else:
            logger.info(f"No handler for event type: {event_type}")
            await billing_service.mark_event_processed(db, billing_event)
            await db.commit()

        return {"status": "success"}

    except Exception as e:
        logger.error(f"Failed to process event {event_id}: {e}", exc_info=True)
        await billing_service.mark_event_failed(db, billing_event)
        await db.commit()
        # Return 200 anyway so Stripe doesn't retry
        return {"status": "error", "message": str(e)}


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse, dependencies=[Depends(require_billing_read())])
async def create_checkout_session(
    request: CheckoutSessionRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> CheckoutSessionResponse:
    """
    Create a Stripe Checkout session for plan upgrade.

    Requires authentication. Creates a checkout session for the current user's
    organization to subscribe to a new plan.
    """
    # Get organization
    organization = await get_organization_record(profile, db)

    # Create checkout session
    checkout_url = await billing_service.create_checkout_session(
        db=db,
        organization=organization,
        price_id=request.price_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    return CheckoutSessionResponse(url=checkout_url)


@router.get("/usage", response_model=BillingUsageResponse, dependencies=[Depends(require_billing_read())])
async def get_usage(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> BillingUsageResponse:
    """
    Get current organization usage and limits.

    Returns usage counters, entitlement limits, plan metadata, and the
    associated Stripe subscription summary for the current organization.
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

    subscription_info = None
    if organization.stripe_subscription_id:
        try:
            stripe_subscription = await billing_service.retrieve_subscription(
                organization.stripe_subscription_id
            )
            subscription_info = _build_subscription_info(stripe_subscription)
        except HTTPException:
            subscription_info = None

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


@router.post(
    "/subscription/cancel",
    response_model=SubscriptionActionResponse,
    dependencies=[Depends(require_billing_read())]
)
async def cancel_subscription(
    request: SubscriptionCancelRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> SubscriptionActionResponse:
    organization = await get_organization_record(profile, db)
    if not organization.stripe_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization does not have an active subscription"
        )

    subscription = await billing_service.cancel_subscription(
        organization.stripe_subscription_id,
        at_period_end=request.at_period_end
    )

    if subscription.status == "canceled":
        organization.billing_status = "canceled"
    organization.subscription_status = billing_service.normalize_subscription_status(subscription.status)
    db.add(organization)
    await db.commit()
    await db.refresh(organization)

    return SubscriptionActionResponse(subscription=_build_subscription_info(subscription))


@router.post(
    "/subscription/resume",
    response_model=SubscriptionActionResponse,
    dependencies=[Depends(require_billing_read())]
)
async def resume_subscription(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> SubscriptionActionResponse:
    organization = await get_organization_record(profile, db)
    if not organization.stripe_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization does not have an active subscription"
        )

    subscription = await billing_service.resume_subscription(organization.stripe_subscription_id)
    organization.billing_status = "active"
    organization.subscription_status = billing_service.normalize_subscription_status(subscription.status)
    db.add(organization)
    await db.commit()
    await db.refresh(organization)

    return SubscriptionActionResponse(subscription=_build_subscription_info(subscription))


@router.post(
    "/portal-session",
    response_model=PortalSessionResponse,
    dependencies=[Depends(require_billing_read())]
)
async def create_portal_session(
    request: PortalSessionRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> PortalSessionResponse:
    organization = await get_organization_record(profile, db)
    if not organization.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization does not have a Stripe customer"
        )

    return_url = request.return_url or settings.FRONTEND_URL
    portal_url = await billing_service.create_portal_session(
        organization.stripe_customer_id,
        return_url
    )

    return PortalSessionResponse(url=portal_url)


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


def _build_subscription_info(subscription: stripe.Subscription) -> SubscriptionInfo:
    items = subscription.get("items", {}).get("data", [])
    price_id = None
    if items:
        price_info = items[0].get("price")
        if isinstance(price_info, dict):
            price_id = price_info.get("id")
    latest_invoice = subscription.get("latest_invoice")
    latest_invoice_id = None
    if isinstance(latest_invoice, dict):
        latest_invoice_id = latest_invoice.get("id")
    elif isinstance(latest_invoice, str):
        latest_invoice_id = latest_invoice

    return SubscriptionInfo(
        id=subscription["id"],
        status=subscription["status"],
        cancel_at_period_end=bool(subscription.get("cancel_at_period_end")),
        canceled_at=_timestamp_to_datetime(subscription.get("canceled_at")),
        cancel_at=_timestamp_to_datetime(subscription.get("cancel_at")),
        current_period_start=_timestamp_to_datetime(subscription.get("current_period_start")),
        current_period_end=_timestamp_to_datetime(subscription.get("current_period_end")),
        trial_start=_timestamp_to_datetime(subscription.get("trial_start")),
        trial_end=_timestamp_to_datetime(subscription.get("trial_end")),
        price_id=price_id,
        plan_id=None,
        latest_invoice=latest_invoice_id,
    )


def _timestamp_to_datetime(value: Optional[int]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.utcfromtimestamp(value)
