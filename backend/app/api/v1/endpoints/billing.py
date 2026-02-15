"""Billing and Stripe webhook endpoints."""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

from app.api.deps import get_current_profile, get_db, require_billing_checkout
from app.core.config import settings
from app.models.profiles import Profile
from app.models.billing import Plan, BillingEvent
from app.schemas.billing import (
    BillingUsageResponse,
    EntitlementInfo,
    PlanInfo,
    SubscriptionInfo,
    BillingPurchaseResponse,
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

    if await billing_service.is_event_processed(db, event_id):
        logger.info(f"Event {event_id} already processed, skipping")
        return {"status": "success", "message": "Event already processed"}

    billing_event = await billing_service.record_billing_event(
        db, event_id, event_type, "received"
    )

    try:
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse, dependencies=[Depends(require_billing_checkout())])
async def create_checkout_session(
    request: CheckoutSessionRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> CheckoutSessionResponse:
    """
    Create a Stripe Checkout session for plan upgrade.
    """
    organization = await get_organization_record(profile, db)

    checkout_url = await billing_service.create_checkout_session(
        db=db,
        organization=organization,
        price_id=request.price_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        customer_email=profile.email,
    )

    return CheckoutSessionResponse(url=checkout_url)


@router.get("/usage", response_model=BillingUsageResponse, dependencies=[Depends(require_billing_checkout())])
async def get_usage(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> BillingUsageResponse:
    """
    Get current organization usage and limits.
    """
    from app.services.entitlements import get_entitlement, _get_or_create_usage

    organization = await get_organization_record(profile, db)
    original_access_end = organization.access_ends_at
    await billing_service.ensure_access_end_for_paid_org(db, organization)
    if original_access_end is None and organization.access_ends_at is not None:
        await db.commit()

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
    
    days_until_access_end = None
    if organization.access_ends_at:
        days_until_access_end = (organization.access_ends_at - datetime.now(timezone.utc)).days
    
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
        access_ends_at=organization.access_ends_at,
        days_until_access_end=days_until_access_end,
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
    return datetime.fromtimestamp(value, tz=timezone.utc)


@router.get("/history", response_model=list[BillingPurchaseResponse])
async def get_billing_history(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> list[BillingPurchaseResponse]:
    """
    Get billing history (purchases) for the current organization.
    """
    from app.models.refunds import BillingPurchase

    if not profile.organization_id:
        return []

    query = select(BillingPurchase).where(
        BillingPurchase.organization_id == profile.organization_id
    ).order_by(BillingPurchase.paid_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    purchases = result.scalars().all()

    # Backward-compatible auto-backfill:
    # Older organizations may have payment ledger events but no billing_purchases rows.
    # Create missing purchase rows from successful payment events so billing history remains complete.
    if not purchases:
        event_query = (
            select(BillingEvent)
            .where(
                BillingEvent.organization_id == profile.organization_id,
                BillingEvent.event_type.in_(["payment_success", "invoice.payment_succeeded", "invoice.paid"]),
                BillingEvent.status.in_(["succeeded", "processed"]),
            )
            .order_by(BillingEvent.processed_at.desc().nullslast(), BillingEvent.received_at.desc())
            .limit(limit)
        )
        event_result = await db.execute(event_query)
        events = event_result.scalars().all()

        created_any = False
        for event in events:
            if not event.amount_cents or event.amount_cents <= 0:
                continue

            if event.external_id:
                existing_query = select(BillingPurchase).where(
                    BillingPurchase.organization_id == profile.organization_id,
                    or_(
                        BillingPurchase.source_billing_event_id == event.id,
                        BillingPurchase.external_charge_id == event.external_id,
                    ),
                )
            else:
                existing_query = select(BillingPurchase).where(
                    BillingPurchase.organization_id == profile.organization_id,
                    BillingPurchase.source_billing_event_id == event.id,
                )

            existing_result = await db.execute(existing_query)
            existing = existing_result.scalar_one_or_none()
            if existing:
                continue

            purchase = BillingPurchase(
                organization_id=profile.organization_id,
                source_billing_event_id=event.id,
                provider=event.provider or "stripe",
                external_charge_id=event.external_id,
                plan_name=event.plan_name,
                amount_paid_cents=event.amount_cents,
                currency=event.currency or "BRL",
                paid_at=event.processed_at or event.received_at or datetime.now(timezone.utc),
                total_refunded_cents=0,
            )
            db.add(purchase)
            created_any = True

        if created_any:
            await db.commit()

        result = await db.execute(query)
        purchases = result.scalars().all()

    return [
        BillingPurchaseResponse(
            id=p.id,
            organization_id=p.organization_id,
            provider=p.provider,
            plan_name=p.plan_name,
            amount_paid_cents=p.amount_paid_cents,
            currency=p.currency,
            paid_at=p.paid_at,
            total_refunded_cents=p.total_refunded_cents,
            has_refund_request=False,
            created_at=p.created_at,
        )
        for p in purchases
    ]
