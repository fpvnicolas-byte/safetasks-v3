"""Stripe Connect service for organization payment onboarding.

Handles OAuth-based Standard account onboarding, account status checks,
and disconnection for Stripe Connect integrations.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organizations import Organization
from app.models.financial import Invoice, InvoicePaymentMethodEnum
from app.models.transactions import Transaction
from app.models.billing import BillingEvent

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


# ─── OAuth Onboarding ────────────────────────────────────────────────────────

async def create_connect_onboarding_url(
    organization: Organization,
    redirect_uri: str,
) -> str:
    """
    Generate the Stripe OAuth authorization URL for Standard account onboarding.

    Args:
        organization: The organization initiating the connection
        redirect_uri: The URL Stripe will redirect back to after OAuth

    Returns:
        The Stripe OAuth authorization URL
    """
    if not settings.STRIPE_CONNECT_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe Connect is not configured (missing STRIPE_CONNECT_CLIENT_ID)"
        )

    # Build Stripe OAuth URL
    authorize_url = (
        f"https://connect.stripe.com/oauth/authorize"
        f"?response_type=code"
        f"&client_id={settings.STRIPE_CONNECT_CLIENT_ID}"
        f"&scope=read_write"
        f"&redirect_uri={redirect_uri}"
        f"&state={str(organization.id)}"
    )

    logger.info(f"Generated Connect onboarding URL for org {organization.id}")
    return authorize_url


async def handle_connect_oauth_callback(
    db: AsyncSession,
    code: str,
    state: str,
) -> Organization:
    """
    Handle the Stripe OAuth callback after the user authorizes SafeTasks.

    Exchanges the authorization code for a connected account ID and updates
    the organization record.

    Args:
        db: Database session
        code: The OAuth authorization code from Stripe
        state: The state parameter (organization ID)

    Returns:
        The updated Organization
    """
    try:
        org_id = UUID(state)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )

    # Look up the organization
    query = select(Organization).where(Organization.id == org_id)
    result = await db.execute(query)
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Exchange the authorization code for connected account credentials
    try:
        response = stripe.OAuth.token(
            grant_type="authorization_code",
            code=code,
        )
    except stripe.error.InvalidGrantError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authorization code. Please try connecting again."
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe OAuth token exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to connect Stripe account. Please try again."
        )

    connected_account_id = response.get("stripe_user_id")
    if not connected_account_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return an account ID"
        )

    # Update the organization with the connected account
    organization.stripe_connect_account_id = connected_account_id
    organization.stripe_connect_onboarding_complete = True
    organization.stripe_connect_enabled_at = datetime.now(timezone.utc)
    db.add(organization)
    await db.flush()
    await db.refresh(organization)

    logger.info(f"Connected Stripe account {connected_account_id} to org {organization.id}")
    return organization


# ─── Account Status ──────────────────────────────────────────────────────────

async def get_connect_status(
    organization: Organization,
) -> dict:
    """
    Get the Stripe Connect status for an organization.

    Returns connection status, account details (if connected), and
    capabilities information.

    Args:
        organization: The organization to check

    Returns:
        Dictionary with connection status info
    """
    if not organization.stripe_connect_account_id:
        return {
            "connected": False,
            "account_id": None,
            "onboarding_complete": False,
            "enabled_at": None,
            "charges_enabled": False,
            "payouts_enabled": False,
            "livemode": None,
            "business_name": None,
            "details_submitted": None,
            "capabilities": None,
            "requirements": None,
        }

    # Fetch live status from Stripe
    try:
        account = stripe.Account.retrieve(
            organization.stripe_connect_account_id
        )
        requirements = account.get("requirements") or {}
        requirements_summary = {
            "disabled_reason": requirements.get("disabled_reason"),
            "currently_due": requirements.get("currently_due") or [],
            "past_due": requirements.get("past_due") or [],
            "eventually_due": requirements.get("eventually_due") or [],
            "pending_verification": requirements.get("pending_verification") or [],
        }
        return {
            "connected": True,
            "account_id": organization.stripe_connect_account_id,
            "onboarding_complete": organization.stripe_connect_onboarding_complete,
            "enabled_at": organization.stripe_connect_enabled_at.isoformat() if organization.stripe_connect_enabled_at else None,
            "charges_enabled": account.get("charges_enabled", False),
            "payouts_enabled": account.get("payouts_enabled", False),
            "livemode": account.get("livemode"),
            "business_name": account.get("business_profile", {}).get("name") or account.get("settings", {}).get("dashboard", {}).get("display_name"),
            "details_submitted": account.get("details_submitted"),
            "capabilities": dict(account.get("capabilities") or {}),
            "requirements": requirements_summary,
        }
    except stripe.error.PermissionError:
        # Account was likely disconnected from Stripe's side
        logger.warning(f"Lost access to connected account {organization.stripe_connect_account_id}")
        return {
            "connected": True,
            "account_id": organization.stripe_connect_account_id,
            "onboarding_complete": organization.stripe_connect_onboarding_complete,
            "enabled_at": organization.stripe_connect_enabled_at.isoformat() if organization.stripe_connect_enabled_at else None,
            "charges_enabled": False,
            "payouts_enabled": False,
            "livemode": None,
            "business_name": None,
            "details_submitted": None,
            "capabilities": None,
            "requirements": None,
            "error": "Lost access to connected account. Please reconnect.",
        }
    except stripe.error.StripeError as e:
        logger.error(f"Failed to fetch connected account status: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Stripe account status"
        )


# ─── Disconnect ──────────────────────────────────────────────────────────────

async def disconnect_connect_account(
    db: AsyncSession,
    organization: Organization,
) -> Organization:
    """
    Disconnect the organization's Stripe Connected account.

    Deauthorizes the OAuth token on Stripe's side and clears the local record.

    Args:
        db: Database session
        organization: The organization to disconnect

    Returns:
        The updated Organization
    """
    if not organization.stripe_connect_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization does not have a connected Stripe account"
        )

    # Deauthorize on Stripe's side
    try:
        stripe.OAuth.deauthorize(
            client_id=settings.STRIPE_CONNECT_CLIENT_ID,
            stripe_user_id=organization.stripe_connect_account_id,
        )
    except stripe.error.StripeError as e:
        # Log but don't fail — the account may already be disconnected on Stripe's side
        logger.warning(f"Stripe deauthorize failed (may already be disconnected): {e}")

    # Clear local record
    old_account_id = organization.stripe_connect_account_id
    organization.stripe_connect_account_id = None
    organization.stripe_connect_onboarding_complete = False
    organization.stripe_connect_enabled_at = None
    db.add(organization)
    await db.flush()
    await db.refresh(organization)

    logger.info(f"Disconnected Stripe account {old_account_id} from org {organization.id}")
    return organization


# ─── Payment Link (Checkout Session) ─────────────────────────────────────────

async def create_invoice_payment_link(
    db: AsyncSession,
    organization: Organization,
    invoice: Invoice,
) -> Invoice:
    """
    Create a Stripe Checkout Session for an invoice and store the payment link.

    Uses price_data (no pre-registered product needed) and routes the session
    to the organization's connected Stripe account.

    Args:
        db: Database session
        organization: The org (must have stripe_connect_account_id)
        invoice: The invoice to create a payment link for

    Returns:
        The updated Invoice with payment link info
    """
    # Validate preconditions
    if not organization.stripe_connect_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization has not connected a Stripe account. Go to Settings → Payment Methods."
        )

    if invoice.payment_method != InvoicePaymentMethodEnum.stripe.value and invoice.payment_method != "stripe":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice payment method must be set to 'stripe' to generate a payment link."
        )

    if invoice.status not in ("sent", "overdue"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate payment link for invoice with status '{invoice.status}'. Invoice must be 'sent' or 'overdue'."
        )

    if invoice.total_amount_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice total must be greater than zero."
        )

    frontend_url = str(settings.FRONTEND_URL).rstrip("/")

    try:
        session = stripe.checkout.Session.create(
            line_items=[{
                "price_data": {
                    "currency": invoice.currency.lower() if invoice.currency else "brl",
                    "product_data": {
                        "name": f"Invoice #{invoice.invoice_number}",
                        "description": invoice.description or "Invoice payment",
                    },
                    "unit_amount": invoice.total_amount_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            # Offer multiple payment options directly in Checkout.
            payment_method_types=["card", "boleto"],
            payment_method_options={
                "boleto": {"expires_after_days": 2},
            },
            success_url=f"{frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/payment/cancelled?invoice_id={invoice.id}",
            metadata={
                "invoice_id": str(invoice.id),
                "organization_id": str(invoice.organization_id),
            },
            stripe_account=organization.stripe_connect_account_id,
            expires_at=int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
        )
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create checkout session for invoice {invoice.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create Stripe payment link: {str(e)}"
        )

    # Update invoice with checkout session info
    invoice.stripe_checkout_session_id = session.id
    invoice.payment_link_url = session.url
    invoice.payment_link_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)

    logger.info(f"Created checkout session {session.id} for invoice {invoice.id}")
    return invoice


# ─── Payment Status Check ────────────────────────────────────────────────────

async def get_invoice_payment_status(
    organization: Organization,
    invoice: Invoice,
    db: AsyncSession | None = None,
) -> dict:
    """
    Get the current payment status for an invoice.

    Checks the Stripe Checkout Session status and returns detailed info.

    Args:
        organization: The org (needed for stripe_account)
        invoice: The invoice to check

    Returns:
        Dictionary with payment status info
    """
    result = {
        "invoice_id": str(invoice.id),
        "invoice_status": invoice.status,
        "payment_method": invoice.payment_method,
        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
        "paid_via": invoice.paid_via,
        "payment_link_url": invoice.payment_link_url,
        "payment_link_expires_at": invoice.payment_link_expires_at.isoformat() if invoice.payment_link_expires_at else None,
        "checkout_session_status": None,
        "payment_status": None,
    }

    if not invoice.stripe_checkout_session_id:
        return result

    if not organization.stripe_connect_account_id:
        return result

    try:
        session = stripe.checkout.Session.retrieve(
            invoice.stripe_checkout_session_id,
            stripe_account=organization.stripe_connect_account_id,
        )
        result["checkout_session_status"] = session.get("status")
        result["payment_status"] = session.get("payment_status")

        # Best-effort sync: if Stripe says it's paid but local invoice isn't, update now.
        if (
            db is not None
            and result["payment_status"] == "paid"
            and result["invoice_status"] != "paid"
        ):
            await _mark_invoice_paid_from_checkout_session(db, invoice, session)
            await db.flush()
            await db.refresh(invoice)

            result["invoice_status"] = invoice.status
            result["paid_at"] = invoice.paid_at.isoformat() if invoice.paid_at else None
            result["paid_via"] = invoice.paid_via
            result["payment_link_url"] = invoice.payment_link_url
            result["payment_link_expires_at"] = (
                invoice.payment_link_expires_at.isoformat()
                if invoice.payment_link_expires_at
                else None
            )
        # If the invoice is already paid, make sure we don't keep advertising an "active" payment link.
        elif (
            db is not None
            and result["invoice_status"] == "paid"
            and (invoice.payment_link_url is not None or invoice.payment_link_expires_at is not None)
        ):
            invoice.payment_link_url = None
            invoice.payment_link_expires_at = None
            db.add(invoice)
            await db.flush()
            await db.refresh(invoice)

            result["payment_link_url"] = invoice.payment_link_url
            result["payment_link_expires_at"] = (
                invoice.payment_link_expires_at.isoformat()
                if invoice.payment_link_expires_at
                else None
            )
    except stripe.error.StripeError as e:
        logger.warning(f"Failed to retrieve checkout session {invoice.stripe_checkout_session_id}: {e}")
        result["error"] = "Failed to retrieve payment status from Stripe"

    return result


# ─── Webhook Processing ──────────────────────────────────────────────────────

async def handle_connect_checkout_completed(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """
    Handle checkout.session.completed for a connected account.

    Finds the invoice by stripe_checkout_session_id, marks it as paid,
    and creates a Transaction record.

    Args:
        db: Database session
        event_data: The Stripe event data object
    """
    session = event_data["object"]
    session_id = session["id"]
    payment_status = session.get("payment_status", "")
    metadata = session.get("metadata", {})
    invoice_id_str = metadata.get("invoice_id")

    if not invoice_id_str:
        logger.warning(f"checkout.session.completed missing invoice_id in metadata: {session_id}")
        return

    try:
        invoice_id = UUID(invoice_id_str)
    except (ValueError, TypeError):
        logger.error(f"Invalid invoice_id in checkout session metadata: {invoice_id_str}")
        return

    # Find the invoice
    query = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()

    if not invoice:
        logger.warning(f"Invoice {invoice_id} not found for checkout session {session_id}")
        return

    # Idempotency: already paid?
    if invoice.status == "paid":
        logger.info(f"Invoice {invoice_id} already marked as paid, skipping")
        return

    if payment_status == "paid":
        await _mark_invoice_paid_from_checkout_session(db, invoice, session)
        logger.info(f"Marked invoice {invoice_id} as paid via Stripe (session: {session_id})")

    elif payment_status == "unpaid":
        # Boleto generated but not yet paid — leave as sent
        logger.info(f"Invoice {invoice_id} awaiting async payment (boleto)")


async def handle_connect_async_payment_succeeded(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """
    Handle checkout.session.async_payment_succeeded for a connected account.

    This fires when a Boleto payment is confirmed.
    """
    session = event_data["object"]
    session_id = session["id"]
    metadata = session.get("metadata", {})
    invoice_id_str = metadata.get("invoice_id")

    if not invoice_id_str:
        logger.warning(f"async_payment_succeeded missing invoice_id: {session_id}")
        return

    try:
        invoice_id = UUID(invoice_id_str)
    except (ValueError, TypeError):
        logger.error(f"Invalid invoice_id in async payment metadata: {invoice_id_str}")
        return

    query = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()

    if not invoice:
        logger.warning(f"Invoice {invoice_id} not found for async payment")
        return

    if invoice.status == "paid":
        logger.info(f"Invoice {invoice_id} already paid, skipping async payment event")
        return

    await _mark_invoice_paid_from_checkout_session(db, invoice, session)
    logger.info(f"Marked invoice {invoice_id} as paid via async payment")


async def handle_connect_async_payment_failed(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """
    Handle checkout.session.async_payment_failed for a connected account.

    Boleto expired or async payment failed. Log for admin notification.
    """
    session = event_data["object"]
    session_id = session["id"]
    metadata = session.get("metadata", {})
    invoice_id_str = metadata.get("invoice_id")

    if not invoice_id_str:
        return

    logger.warning(f"Async payment failed for checkout session {session_id}, invoice {invoice_id_str}")
    # Future: send notification to admin


async def handle_connect_account_updated(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """
    Handle account.updated for a connected account.

    Tracks onboarding status changes.
    """
    account = event_data["object"]
    account_id = account.get("id")

    if not account_id:
        return

    query = select(Organization).where(Organization.stripe_connect_account_id == account_id)
    result = await db.execute(query)
    organization = result.scalar_one_or_none()

    if not organization:
        logger.info(f"No org found for connected account {account_id}")
        return

    charges_enabled = account.get("charges_enabled", False)
    if charges_enabled and not organization.stripe_connect_onboarding_complete:
        organization.stripe_connect_onboarding_complete = True
        db.add(organization)
        logger.info(f"Connected account {account_id} onboarding complete for org {organization.id}")


# ─── Connect Webhook Event Handler Map ───────────────────────────────────────

CONNECT_EVENT_HANDLERS = {
    "checkout.session.completed": handle_connect_checkout_completed,
    "checkout.session.async_payment_succeeded": handle_connect_async_payment_succeeded,
    "checkout.session.async_payment_failed": handle_connect_async_payment_failed,
    "account.updated": handle_connect_account_updated,
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _determine_paid_via(session: dict) -> str:
    """Determine the actual payment method used from a checkout session."""
    payment_method_types = session.get("payment_method_types", [])

    if len(payment_method_types) == 1:
        method = payment_method_types[0]
        return f"stripe_{method}"

    # If multiple methods were offered, check the payment_method_collection
    # Default to generic "stripe" if we can't determine
    return "stripe"


async def _mark_invoice_paid_from_checkout_session(
    db: AsyncSession,
    invoice: Invoice,
    session: dict,
) -> None:
    """
    Mark an invoice as paid based on a Stripe Checkout Session and deactivate its payment link.

    This is used both by webhooks and by best-effort polling sync.
    """
    invoice.status = "paid"
    invoice.paid_at = datetime.now(timezone.utc)
    invoice.paid_date = datetime.now(timezone.utc).date()
    invoice.paid_via = _determine_paid_via(session)

    payment_intent_id = session.get("payment_intent")
    if payment_intent_id:
        invoice.stripe_payment_intent_id = payment_intent_id

    # Deactivate the link in our UI once the invoice is paid.
    invoice.payment_link_url = None
    invoice.payment_link_expires_at = None

    db.add(invoice)

    # Create a transaction record for the income (best-effort; may be skipped if no default bank account).
    await _create_payment_transaction(db, invoice)


async def _create_payment_transaction(
    db: AsyncSession,
    invoice: Invoice,
) -> Optional[Transaction]:
    """
    Create an income transaction record for a paid invoice.

    Looks for the organization's default bank account and creates a transaction.
    """
    # Get the organization to find default bank account
    query = select(Organization).where(Organization.id == invoice.organization_id)
    result = await db.execute(query)
    organization = result.scalar_one_or_none()

    if not organization or not organization.default_bank_account_id:
        logger.warning(
            f"Cannot create transaction for invoice {invoice.id}: "
            f"no default bank account on org {invoice.organization_id}"
        )
        return None

    transaction = Transaction(
        organization_id=invoice.organization_id,
        bank_account_id=organization.default_bank_account_id,
        project_id=invoice.project_id,
        invoice_id=invoice.id,
        category="production_revenue",
        type="income",
        amount_cents=invoice.total_amount_cents,
        description=f"Payment received for Invoice #{invoice.invoice_number}",
        payment_status="paid",
        paid_at=invoice.paid_at,
    )
    db.add(transaction)
    logger.info(f"Created income transaction for invoice {invoice.id}")
    return transaction
