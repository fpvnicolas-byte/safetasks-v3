"""Billing and Stripe webhook endpoints."""
import logging
from typing import Any
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_profile, get_db, require_billing_read
from app.core.config import settings
from app.models.profiles import Profile
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


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
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


@router.get("/usage", dependencies=[Depends(require_billing_read())])
async def get_usage(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """
    Get current organization usage and limits.

    Returns usage counters and entitlement limits for the current organization.
    """
    from app.services.entitlements import get_entitlement, _get_or_create_usage

    organization = await get_organization_record(profile, db)
    entitlement = await get_entitlement(db, organization)
    usage = await _get_or_create_usage(db, organization.id)

    return {
        "organization_id": str(organization.id),
        "plan_id": str(organization.plan_id) if organization.plan_id else None,
        "billing_status": organization.billing_status,
        "trial_ends_at": organization.trial_ends_at.isoformat() if organization.trial_ends_at else None,
        "usage": {
            "projects": usage.projects_count,
            "clients": usage.clients_count,
            "proposals": usage.proposals_count,
            "users": usage.users_count,
            "storage_bytes": usage.storage_bytes_used,
            "ai_credits": usage.ai_credits_used,
        },
        "limits": {
            "projects": entitlement.max_projects if entitlement else None,
            "clients": entitlement.max_clients if entitlement else None,
            "proposals": entitlement.max_proposals if entitlement else None,
            "users": entitlement.max_users if entitlement else None,
            "storage_bytes": entitlement.max_storage_bytes if entitlement else None,
            "ai_credits": entitlement.ai_credits if entitlement else None,
        }
    }
