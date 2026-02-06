"""Stripe Connect endpoints for organization payment onboarding and invoice payments.

Provides:
- OAuth onboarding flow (connect/disconnect Stripe accounts)
- Payment link generation for invoices
- Payment status checking
- Webhook handler for connected account events
"""
import logging
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_profile,
    get_db,
    get_organization_record,
    require_finance_or_admin,
    require_billing_active,
)
from app.core.config import settings
from app.models.financial import Invoice
from app.models.profiles import Profile
from app.services import stripe_connect as connect_service
from app.services.billing import is_event_processed, record_billing_event, mark_event_processed, mark_event_failed

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request/Response Schemas ─────────────────────────────────────────────────

class ConnectOnboardRequest(BaseModel):
    """Request to initiate Stripe Connect onboarding."""
    redirect_uri: str


class ConnectOnboardResponse(BaseModel):
    """Response with Stripe authorization URL."""
    authorization_url: str


class ConnectStatusResponse(BaseModel):
    """Response with Stripe Connect status."""
    connected: bool
    account_id: str | None = None
    onboarding_complete: bool = False
    enabled_at: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    business_name: str | None = None
    error: str | None = None


class PaymentLinkResponse(BaseModel):
    """Response with generated payment link."""
    invoice_id: str
    payment_link_url: str
    stripe_checkout_session_id: str
    expires_at: str | None = None


class PaymentStatusResponse(BaseModel):
    """Response with invoice payment status."""
    invoice_id: str
    invoice_status: str
    payment_method: str | None = None
    paid_at: str | None = None
    paid_via: str | None = None
    payment_link_url: str | None = None
    payment_link_expires_at: str | None = None
    checkout_session_status: str | None = None
    payment_status: str | None = None
    error: str | None = None


# ─── Stripe Connect Onboarding Endpoints ─────────────────────────────────────

@router.post(
    "/onboard",
    response_model=ConnectOnboardResponse,
    dependencies=[Depends(require_finance_or_admin)],
)
async def initiate_connect_onboarding(
    request: ConnectOnboardRequest,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ConnectOnboardResponse:
    """
    Initiate Stripe Connect OAuth onboarding for the organization.

    Returns a Stripe authorization URL that the admin should be redirected to.
    After authorizing, Stripe will redirect back to the provided redirect_uri.
    """
    organization = await get_organization_record(profile, db)

    if organization.stripe_connect_account_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization already has a connected Stripe account. Disconnect first to reconnect."
        )

    authorization_url = await connect_service.create_connect_onboarding_url(
        organization=organization,
        redirect_uri=request.redirect_uri,
    )

    return ConnectOnboardResponse(authorization_url=authorization_url)


@router.get("/callback")
async def connect_oauth_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Handle Stripe Connect OAuth callback.

    This endpoint receives the authorization code from Stripe after the user
    authorizes SafeTasks. It exchanges the code for a connected account ID.

    Note: This endpoint does NOT require authentication because it's called
    by the browser redirect from Stripe.
    """
    organization = await connect_service.handle_connect_oauth_callback(
        db=db,
        code=code,
        state=state,
    )
    await db.commit()

    return {
        "status": "success",
        "message": "Stripe account connected successfully",
        "account_id": organization.stripe_connect_account_id,
    }


@router.get(
    "/status",
    response_model=ConnectStatusResponse,
    dependencies=[Depends(require_finance_or_admin)],
)
async def get_connect_status(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ConnectStatusResponse:
    """
    Get the Stripe Connect connection status for the current organization.

    Returns whether the org is connected, account capabilities, and business info.
    """
    organization = await get_organization_record(profile, db)
    status_info = await connect_service.get_connect_status(organization)
    return ConnectStatusResponse(**status_info)


@router.delete(
    "/disconnect",
    dependencies=[Depends(require_finance_or_admin)],
)
async def disconnect_connect_account(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Disconnect the organization's Stripe Connected account.

    This deauthorizes the OAuth connection and clears the local record.
    Existing payment links will stop working.
    """
    organization = await get_organization_record(profile, db)
    await connect_service.disconnect_connect_account(db, organization)
    await db.commit()

    return {
        "status": "success",
        "message": "Stripe account disconnected successfully",
    }


# ─── Invoice Payment Link Endpoints ──────────────────────────────────────────

@router.post(
    "/invoices/{invoice_id}/payment-link",
    response_model=PaymentLinkResponse,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active())],
)
async def generate_payment_link(
    invoice_id: UUID,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> PaymentLinkResponse:
    """
    Generate a Stripe Checkout payment link for an invoice.

    Creates a Checkout Session on the organization's connected Stripe account.
    The invoice must have payment_method='stripe' and status='sent' or 'overdue'.
    """
    organization = await get_organization_record(profile, db)

    # Get the invoice (with org tenant isolation)
    query = select(Invoice).where(
        Invoice.id == invoice_id,
        Invoice.organization_id == organization.id,
        Invoice.is_active == True,
    )
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    updated_invoice = await connect_service.create_invoice_payment_link(
        db=db,
        organization=organization,
        invoice=invoice,
    )
    await db.commit()

    return PaymentLinkResponse(
        invoice_id=str(updated_invoice.id),
        payment_link_url=updated_invoice.payment_link_url,
        stripe_checkout_session_id=updated_invoice.stripe_checkout_session_id,
        expires_at=updated_invoice.payment_link_expires_at.isoformat() if updated_invoice.payment_link_expires_at else None,
    )


@router.get(
    "/invoices/{invoice_id}/payment-status",
    response_model=PaymentStatusResponse,
    dependencies=[Depends(require_finance_or_admin)],
)
async def get_payment_status(
    invoice_id: UUID,
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """
    Get the current payment status for an invoice.

    Checks both the local status and the live Stripe Checkout Session status.
    """
    organization = await get_organization_record(profile, db)

    query = select(Invoice).where(
        Invoice.id == invoice_id,
        Invoice.organization_id == organization.id,
        Invoice.is_active == True,
    )
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    status_info = await connect_service.get_invoice_payment_status(
        organization=organization,
        invoice=invoice,
    )
    return PaymentStatusResponse(**status_info)


# ─── Stripe Connect Webhook ──────────────────────────────────────────────────

@router.post("/webhooks/stripe-connect")
async def stripe_connect_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Handle Stripe Connect webhook events for connected accounts.

    This is a SEPARATE webhook endpoint from the main /billing/webhooks/stripe
    endpoint. It handles events from connected accounts (e.g., payment completion).

    Security: Verifies webhook signature using STRIPE_CONNECT_WEBHOOK_SECRET.
    Idempotency: Checks BillingEvent table to prevent duplicate processing.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header"
        )

    webhook_secret = settings.STRIPE_CONNECT_WEBHOOK_SECRET
    if not webhook_secret:
        logger.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Connect webhook secret not configured"
        )

    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        logger.error("Invalid Connect webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid Connect webhook signature")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )

    event_id = event["id"]
    event_type = event["type"]
    event_data = event["data"]

    logger.info(f"Received Connect webhook event: {event_type} ({event_id})")

    # Check idempotency
    if await is_event_processed(db, event_id):
        logger.info(f"Connect event {event_id} already processed, skipping")
        return {"status": "success", "message": "Event already processed"}

    # Record event
    billing_event = await record_billing_event(
        db, event_id, event_type, "received"
    )

    try:
        handler = connect_service.CONNECT_EVENT_HANDLERS.get(event_type)
        if handler:
            await handler(db, event_data)
            await mark_event_processed(db, billing_event)
            await db.commit()
            logger.info(f"Successfully processed Connect event {event_id}")
        else:
            logger.info(f"No handler for Connect event type: {event_type}")
            await mark_event_processed(db, billing_event)
            await db.commit()

        return {"status": "success"}

    except Exception as e:
        logger.error(f"Failed to process Connect event {event_id}: {e}", exc_info=True)
        await mark_event_failed(db, billing_event)
        await db.commit()
        # Return 200 so Stripe doesn't retry
        return {"status": "error", "message": str(e)}
