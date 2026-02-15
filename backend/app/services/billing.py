"""Billing service for Stripe checkout and billing event integration."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.billing import BillingEvent, OrganizationUsage, Plan
from app.models.organizations import Organization
from app.models.refunds import BillingPurchase

logger = logging.getLogger(__name__)

PLAN_DURATION_DAYS = {
    "starter": 30,
    "professional": 30,
    "professional_annual": 365,
}

PAID_ACTIVE_BILLING_STATUSES = {"active", "billing_pending_review"}

SUBSCRIPTION_STATUS_MAP = {
    "active": "active",
    "trialing": "trialing",
    "past_due": "past_due",
    "unpaid": "past_due",
    "canceled": "cancelled",
    "paused": "paused",
    "incomplete": "paused",
    "incomplete_expired": "cancelled",
}


def _configure_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe secret key not configured",
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _timestamp_to_datetime(value: Optional[int]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _extract_subscription_price_id(subscription: dict) -> Optional[str]:
    items = subscription.get("items", {}).get("data", [])
    if not items:
        return None
    price_info = items[0].get("price")
    if isinstance(price_info, dict):
        return price_info.get("id")
    return None


def _extract_subscription_period_end(subscription: dict) -> Optional[datetime]:
    period_end = subscription.get("current_period_end")
    if isinstance(period_end, int):
        return datetime.fromtimestamp(period_end, tz=timezone.utc)
    return None


async def get_pro_trial_plan(db: AsyncSession) -> Plan:
    """Get the pro_trial plan."""
    query = select(Plan).where(Plan.name == "pro_trial")
    result = await db.execute(query)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pro_trial plan not found - run seed_plans_entitlements.py",
        )
    return plan


async def setup_trial_for_organization(
    db: AsyncSession,
    organization: Organization,
    user_email: str,
) -> None:
    """
    Set up 7-day Pro trial for a new organization.

    Steps:
    1. Set plan_id to pro_trial
    2. Set billing_status to trial_active
    3. Set trial_ends_at to now() + 7 days
    4. Create initial OrganizationUsage record
    """
    del user_email  # Created lazily at checkout time if stripe_customer_id is missing.

    trial_plan = await get_pro_trial_plan(db)

    organization.plan_id = trial_plan.id
    organization.plan = "professional"
    organization.subscription_status = "trialing"
    organization.billing_status = "trial_active"
    organization.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=7)
    organization.access_ends_at = organization.trial_ends_at

    usage = OrganizationUsage(org_id=organization.id)
    db.add(usage)
    db.add(organization)

    logger.info("Set up 7-day trial for org %s, expires %s", organization.id, organization.trial_ends_at)


async def create_stripe_customer(
    email: str,
    name: str,
    org_id: UUID,
) -> str:
    """Create a Stripe customer and return the customer ID."""
    _configure_stripe()
    try:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"org_id": str(org_id)},
        )
        logger.info("Created Stripe customer %s for org %s", customer.id, org_id)
        return customer.id
    except stripe.error.StripeError as e:
        logger.error("Failed to create Stripe customer: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create billing customer",
        )


async def get_plan_by_price_id(db: AsyncSession, price_id: str) -> Optional[Plan]:
    """Get plan by Stripe price ID."""
    query = select(Plan).where(Plan.stripe_price_id == price_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_checkout_session(
    db: AsyncSession,
    organization: Organization,
    price_id: str,
    success_url: str,
    cancel_url: str,
    customer_email: Optional[str],
) -> str:
    """
    Create a Stripe Checkout session for a plan upgrade.
    """
    _configure_stripe()

    plan = await get_plan_by_price_id(db, price_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan selected",
        )

    if organization.stripe_subscription_id and organization.billing_status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization already has an active subscription.",
        )

    if not organization.stripe_customer_id:
        if not customer_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization does not have a Stripe customer and no user email was provided",
            )
        organization.stripe_customer_id = await create_stripe_customer(
            email=customer_email,
            name=organization.name,
            org_id=organization.id,
        )
        db.add(organization)
        await db.commit()
        await db.refresh(organization)

    try:
        session = stripe.checkout.Session.create(
            customer=organization.stripe_customer_id,
            payment_method_types=["card", "boleto"],
            payment_method_options={
                "boleto": {"expires_after_days": 3},
            },
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"org_id": str(organization.id), "plan_name": plan.name},
        )
        logger.info("Created Stripe checkout session %s for org %s", session.id, organization.id)
        return session.url
    except stripe.error.StripeError as e:
        logger.error("Failed to create checkout session: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session",
        )


async def retrieve_subscription(subscription_id: str) -> stripe.Subscription:
    """Retrieve a Stripe subscription."""
    _configure_stripe()
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return subscription
    except stripe.error.StripeError as e:
        logger.error("Failed to retrieve Stripe subscription %s: %s", subscription_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Stripe subscription",
        )


def normalize_subscription_status(stripe_status: Optional[str]) -> str:
    if not stripe_status:
        return "active"
    return SUBSCRIPTION_STATUS_MAP.get(stripe_status, "active")


def map_subscription_billing_status(stripe_status: Optional[str]) -> str:
    status_map = {
        "active": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "unpaid": "past_due",
        "incomplete": "billing_pending_review",
        "incomplete_expired": "canceled",
        "trialing": "trial_active",
        "paused": "past_due",
    }
    return status_map.get(stripe_status or "", "billing_pending_review")


async def get_organization_by_stripe_customer_id(
    db: AsyncSession,
    stripe_customer_id: str,
) -> Optional[Organization]:
    """Get organization by Stripe customer ID."""
    query = select(Organization).where(Organization.stripe_customer_id == stripe_customer_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def _resolve_org_plan_name(db: AsyncSession, organization: Organization) -> Optional[str]:
    """Resolve organization plan name, preferring canonical plans table."""
    if organization.plan_id:
        query = select(Plan).where(Plan.id == organization.plan_id)
        result = await db.execute(query)
        plan = result.scalar_one_or_none()
        if plan and plan.name:
            return plan.name
    return organization.plan


async def _infer_access_end_from_ledger(
    db: AsyncSession,
    organization: Organization,
) -> Optional[datetime]:
    """Infer paid access end using the latest successful billing event."""
    query = (
        select(BillingEvent)
        .where(
            BillingEvent.organization_id == organization.id,
            BillingEvent.plan_name.isnot(None),
            BillingEvent.plan_name.in_(list(PLAN_DURATION_DAYS.keys())),
            BillingEvent.status.in_(["succeeded", "processed"]),
        )
        .order_by(BillingEvent.processed_at.desc().nullslast(), BillingEvent.received_at.desc())
    )
    result = await db.execute(query)
    event = result.scalars().first()
    if not event or not event.plan_name:
        return None

    duration_days = PLAN_DURATION_DAYS.get(event.plan_name)
    if not duration_days:
        return None

    base_dt = event.processed_at or event.received_at
    if not base_dt:
        return None

    return base_dt + timedelta(days=duration_days)


async def ensure_access_end_for_paid_org(
    db: AsyncSession,
    organization: Organization,
) -> Optional[datetime]:
    """
    Ensure paid organizations have an `access_ends_at` value.

    This is a legacy-repair guard for orgs migrated from older billing states
    where status/plan were active but expiration was never persisted.
    """
    if organization.access_ends_at is not None:
        return organization.access_ends_at

    is_paid_status = (
        organization.billing_status in PAID_ACTIVE_BILLING_STATUSES
        or organization.subscription_status == "active"
    )
    if not is_paid_status:
        return None

    inferred_end = await _infer_access_end_from_ledger(db, organization)
    source = "ledger"

    if inferred_end is None:
        plan_name = await _resolve_org_plan_name(db, organization)
        duration_days = PLAN_DURATION_DAYS.get(plan_name or "")
        if duration_days is None:
            logger.warning(
                "Could not infer access_ends_at for org %s (plan=%s, plan_id=%s)",
                organization.id,
                organization.plan,
                organization.plan_id,
            )
            return None

        inferred_end = datetime.now(timezone.utc) + timedelta(days=duration_days)
        source = "fallback_now_plus_plan_duration"

    organization.access_ends_at = inferred_end
    db.add(organization)
    logger.warning(
        "Backfilled access_ends_at for org %s using %s: %s",
        organization.id,
        source,
        inferred_end.isoformat(),
    )
    return inferred_end


async def handle_customer_created(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.created event."""
    customer = event_data["object"]
    customer_id = customer["id"]
    org_id_str = customer.get("metadata", {}).get("org_id")

    if not org_id_str:
        logger.warning("customer.created event missing org_id metadata: %s", customer_id)
        return

    org_id = UUID(org_id_str)
    query = select(Organization).where(Organization.id == org_id)
    result = await db.execute(query)
    org = result.scalar_one_or_none()

    if org:
        org.stripe_customer_id = customer_id
        db.add(org)
        logger.info("Updated org %s with Stripe customer %s", org_id, customer_id)


async def handle_customer_updated(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.updated event."""
    customer = event_data["object"]
    customer_id = customer["id"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s on update", customer_id)
        return

    if not org.stripe_customer_id:
        org.stripe_customer_id = customer_id
        db.add(org)
        logger.info("Linked org %s to Stripe customer %s", org.id, customer_id)


async def handle_customer_deleted(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.deleted event."""
    customer = event_data["object"]
    customer_id = customer["id"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        return

    org.billing_status = "canceled"
    org.subscription_status = "cancelled"
    db.add(org)
    logger.info("Marked org %s as canceled (customer deleted)", org.id)


async def handle_subscription_created(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.created event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    subscription_id = subscription["id"]
    price_id = _extract_subscription_price_id(subscription)

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s", customer_id)
        return

    if price_id:
        plan = await get_plan_by_price_id(db, price_id)
        if plan:
            org.plan_id = plan.id
            org.plan = plan.name

    period_end = _extract_subscription_period_end(subscription)
    if period_end:
        org.access_ends_at = period_end

    sub_status = subscription.get("status")
    org.stripe_subscription_id = subscription_id
    org.billing_status = map_subscription_billing_status(sub_status)
    org.subscription_status = normalize_subscription_status(sub_status)
    db.add(org)
    logger.info("Subscription %s created for org %s with status %s", subscription_id, org.id, sub_status)


async def handle_subscription_updated(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.updated event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    subscription_id = subscription["id"]
    sub_status = subscription["status"]
    price_id = _extract_subscription_price_id(subscription)

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s", customer_id)
        return

    if price_id:
        plan = await get_plan_by_price_id(db, price_id)
        if plan:
            org.plan_id = plan.id
            org.plan = plan.name

    org.billing_status = map_subscription_billing_status(sub_status)
    org.subscription_status = normalize_subscription_status(sub_status)

    period_end = _extract_subscription_period_end(subscription)
    if period_end:
        org.access_ends_at = period_end

    db.add(org)
    logger.info("Subscription %s updated for org %s: %s", subscription_id, org.id, sub_status)


async def handle_subscription_trial_will_end(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.trial_will_end event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    trial_end = subscription.get("trial_end")

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s", customer_id)
        return

    if trial_end:
        org.trial_ends_at = datetime.fromtimestamp(trial_end, tz=timezone.utc)
        db.add(org)
        logger.info("Trial will end for org %s at %s", org.id, org.trial_ends_at)


async def handle_subscription_deleted(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.deleted event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        return

    org.billing_status = "canceled"
    org.subscription_status = "cancelled"
    db.add(org)
    logger.info("Subscription deleted for org %s", org.id)


async def handle_invoice_payment_succeeded(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.payment_succeeded event."""
    invoice = event_data["object"]
    customer_id = invoice.get("customer")
    invoice_id = invoice.get("id")

    if not customer_id:
        logger.warning("invoice.payment_succeeded missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for invoice customer %s", customer_id)
        return

    org.billing_status = "active"
    org.subscription_status = "active"

    period_end = None
    lines = invoice.get("lines", {}).get("data", [])
    if lines:
        line_period = lines[0].get("period", {}) if isinstance(lines[0], dict) else {}
        end_ts = line_period.get("end")
        if isinstance(end_ts, int):
            period_end = datetime.fromtimestamp(end_ts, tz=timezone.utc)
    if period_end:
        org.access_ends_at = period_end

    db.add(org)

    amount_paid = invoice.get("amount_paid") or invoice.get("amount_due") or 0
    if invoice_id and amount_paid > 0:
        existing_query = select(BillingPurchase).where(
            BillingPurchase.external_charge_id == invoice_id
        )
        existing_result = await db.execute(existing_query)
        existing = existing_result.scalar_one_or_none()

        if not existing:
            paid_at_ts = (
                invoice.get("status_transitions", {}).get("paid_at")
                if isinstance(invoice.get("status_transitions"), dict)
                else None
            )
            paid_at = _timestamp_to_datetime(paid_at_ts) or datetime.now(timezone.utc)
            plan_name = await _resolve_org_plan_name(db, org)

            purchase = BillingPurchase(
                organization_id=org.id,
                provider="stripe",
                external_charge_id=invoice_id,
                plan_name=plan_name,
                amount_paid_cents=amount_paid,
                currency=(invoice.get("currency") or "BRL").upper(),
                paid_at=paid_at,
            )
            db.add(purchase)

    logger.info("Payment succeeded for org %s", org.id)


async def handle_invoice_payment_failed(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.payment_failed event."""
    invoice = event_data["object"]
    customer_id = invoice.get("customer")

    if not customer_id:
        logger.warning("invoice.payment_failed missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for invoice customer %s", customer_id)
        return

    org.billing_status = "past_due"
    org.subscription_status = "past_due"
    db.add(org)
    logger.info("Payment failed for org %s, set to past_due", org.id)


async def handle_invoice_payment_action_required(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.payment_action_required event."""
    invoice = event_data["object"]
    customer_id = invoice.get("customer")

    if not customer_id:
        logger.warning("invoice.payment_action_required missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for invoice customer %s", customer_id)
        return

    org.billing_status = "billing_pending_review"
    db.add(org)
    logger.info("Payment action required for org %s", org.id)


async def handle_checkout_session_completed(db: AsyncSession, event_data: dict) -> None:
    """Handle checkout.session.completed event."""
    session = event_data["object"]
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    payment_status = session.get("payment_status")
    metadata = session.get("metadata", {}) if isinstance(session.get("metadata"), dict) else {}
    org_id_str = metadata.get("org_id")

    org = None
    if customer_id:
        org = await get_organization_by_stripe_customer_id(db, customer_id)

    if not org and org_id_str:
        try:
            org_id = UUID(org_id_str)
            query = select(Organization).where(Organization.id == org_id)
            result = await db.execute(query)
            org = result.scalar_one_or_none()
        except Exception:
            org = None

    if not org:
        logger.warning("checkout.session.completed could not resolve organization")
        return

    if customer_id and not org.stripe_customer_id:
        org.stripe_customer_id = customer_id
    if subscription_id:
        org.stripe_subscription_id = subscription_id

    if payment_status in {"paid", "no_payment_required"}:
        org.billing_status = "active"
        org.subscription_status = "active"
    else:
        # Delayed methods (for example boleto) can complete checkout before settlement.
        org.billing_status = "billing_pending_review"
    db.add(org)
    logger.info(
        "Checkout completed for org %s with payment_status=%s",
        org.id,
        payment_status,
    )


async def handle_checkout_session_async_payment_succeeded(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """Handle checkout.session.async_payment_succeeded event."""
    session = event_data["object"]
    customer_id = session.get("customer")

    if not customer_id:
        logger.warning("checkout.session.async_payment_succeeded missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for checkout async payment customer %s", customer_id)
        return

    org.billing_status = "active"
    org.subscription_status = "active"
    db.add(org)
    logger.info("Async checkout payment succeeded for org %s", org.id)


async def handle_checkout_session_async_payment_failed(
    db: AsyncSession,
    event_data: dict,
) -> None:
    """Handle checkout.session.async_payment_failed event."""
    session = event_data["object"]
    customer_id = session.get("customer")

    if not customer_id:
        logger.warning("checkout.session.async_payment_failed missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for checkout async payment customer %s", customer_id)
        return

    org.billing_status = "past_due"
    org.subscription_status = "past_due"
    db.add(org)
    logger.warning("Async checkout payment failed for org %s", org.id)


async def handle_invoice_finalized(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.finalized event."""
    invoice = event_data["object"]
    customer_id = invoice.get("customer")

    if not customer_id:
        logger.warning("invoice.finalized missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s", customer_id)
        return

    logger.info("Invoice finalized for org %s", org.id)


async def handle_invoice_finalization_failed(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.finalization_failed event."""
    invoice = event_data["object"]
    customer_id = invoice.get("customer")

    if not customer_id:
        logger.warning("invoice.finalization_failed missing customer")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning("No org found for customer %s", customer_id)
        return

    org.billing_status = "billing_pending_review"
    db.add(org)
    logger.warning("Invoice finalization failed for org %s", org.id)


EVENT_HANDLERS = {
    "customer.created": handle_customer_created,
    "customer.updated": handle_customer_updated,
    "customer.deleted": handle_customer_deleted,
    "customer.subscription.created": handle_subscription_created,
    "customer.subscription.updated": handle_subscription_updated,
    "customer.subscription.paused": handle_subscription_updated,
    "customer.subscription.resumed": handle_subscription_updated,
    "customer.subscription.trial_will_end": handle_subscription_trial_will_end,
    "customer.subscription.deleted": handle_subscription_deleted,
    "invoice.finalized": handle_invoice_finalized,
    "invoice.paid": handle_invoice_payment_succeeded,
    "invoice.payment_succeeded": handle_invoice_payment_succeeded,
    "invoice.payment_failed": handle_invoice_payment_failed,
    "invoice.payment_action_required": handle_invoice_payment_action_required,
    "checkout.session.completed": handle_checkout_session_completed,
    "checkout.session.async_payment_succeeded": handle_checkout_session_async_payment_succeeded,
    "checkout.session.async_payment_failed": handle_checkout_session_async_payment_failed,
    "invoice.finalization_failed": handle_invoice_finalization_failed,
}


def has_active_access(organization: Organization) -> bool:
    """Check if organization has active paid access or trial."""
    now = datetime.now(timezone.utc)

    if organization.access_ends_at and organization.access_ends_at > now:
        return True

    if organization.trial_ends_at and organization.trial_ends_at > now:
        return True

    return False


async def is_event_processed(db: AsyncSession, event_id: str) -> bool:
    """Check if a webhook event has already been processed."""
    query = select(BillingEvent).where(
        (BillingEvent.stripe_event_id == event_id) | (BillingEvent.external_id == event_id),
        BillingEvent.status == "processed",
    )
    result = await db.execute(query)
    return result.scalars().first() is not None


async def record_billing_event(
    db: AsyncSession,
    event_id: str,
    event_type: str,
    status_value: str,
) -> BillingEvent:
    """Record a new billing event."""
    query = select(BillingEvent).where(
        (BillingEvent.stripe_event_id == event_id) | (BillingEvent.external_id == event_id)
    )
    result = await db.execute(query)
    existing = result.scalars().first()

    if existing:
        return existing

    event = BillingEvent(
        stripe_event_id=event_id,
        external_id=event_id,
        event_type=event_type,
        status=status_value,
        provider="stripe",
        received_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    return event


async def mark_event_processed(db: AsyncSession, event: BillingEvent) -> None:
    """Mark event as processed."""
    event.status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.add(event)


async def mark_event_failed(db: AsyncSession, event: BillingEvent) -> None:
    """Mark event as failed."""
    event.status = "failed"
    event.processed_at = datetime.now(timezone.utc)
    db.add(event)
