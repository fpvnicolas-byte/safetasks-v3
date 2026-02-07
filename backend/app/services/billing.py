"""Billing service for Stripe integration."""
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.billing import BillingEvent, Plan, OrganizationUsage
from app.models.organizations import Organization

logger = logging.getLogger(__name__)

# Initialize Stripe with secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


async def get_pro_trial_plan(db: AsyncSession) -> Plan:
    """Get the pro_trial plan."""
    query = select(Plan).where(Plan.name == "pro_trial")
    result = await db.execute(query)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pro_trial plan not found - run seed_plans_entitlements.py"
        )
    return plan


async def setup_trial_for_organization(
    db: AsyncSession,
    organization: Organization,
    user_email: str
) -> None:
    """
    Set up 7-day Pro trial for a new organization.

    This should be called immediately after creating an organization.

    Steps:
    1. Set plan_id to pro_trial
    2. Set billing_status to trial_active
    3. Set trial_ends_at to now() + 7 days
    4. Create Stripe customer
    5. Create initial OrganizationUsage record

    Args:
        db: Database session
        organization: Newly created organization
        user_email: Email of the user creating the org (for Stripe customer)
    """
    # Get pro_trial plan
    trial_plan = await get_pro_trial_plan(db)

    # Set up trial
    organization.plan_id = trial_plan.id
    # Legacy fields for UI/backward compatibility
    organization.plan = "professional"
    organization.subscription_status = "trialing"
    organization.billing_status = "trial_active"
    organization.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=7)

    # Create Stripe customer
    customer_id = await create_stripe_customer(
        email=user_email,
        name=organization.name,
        org_id=organization.id
    )
    organization.stripe_customer_id = customer_id

    # Create initial usage record
    usage = OrganizationUsage(org_id=organization.id)
    db.add(usage)
    db.add(organization)

    logger.info(f"Set up 7-day trial for org {organization.id}, expires {organization.trial_ends_at}")


async def create_stripe_customer(
    email: str,
    name: str,
    org_id: UUID
) -> str:
    """
    Create a Stripe customer and return the customer ID.

    Args:
        email: Customer email address
        name: Organization name
        org_id: Organization UUID for metadata

    Returns:
        Stripe customer ID (cus_xxx)
    """
    try:
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"org_id": str(org_id)}
        )
        logger.info(f"Created Stripe customer {customer.id} for org {org_id}")
        return customer.id
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create Stripe customer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create billing customer"
        )


async def create_checkout_session(
    db: AsyncSession,
    organization: Organization,
    price_id: str,
    success_url: str,
    cancel_url: str
) -> str:
    """
    Create a Stripe Checkout session for plan upgrade.

    Args:
        db: Database session
        organization: Organization upgrading
        price_id: Stripe Price ID to subscribe to
        success_url: URL to redirect on success
        cancel_url: URL to redirect on cancel

    Returns:
        Checkout session URL
    """
    if not organization.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization does not have a Stripe customer"
        )

    try:
        session = stripe.checkout.Session.create(
            customer=organization.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"org_id": str(organization.id)}
        )
        logger.info(f"Created checkout session {session.id} for org {organization.id}")
        return session.url
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create checkout session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session"
        )


async def get_plan_by_price_id(db: AsyncSession, price_id: str) -> Optional[Plan]:
    """Get plan by Stripe price ID."""
    query = select(Plan).where(Plan.stripe_price_id == price_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def is_event_processed(db: AsyncSession, stripe_event_id: str) -> bool:
    """Check if webhook event was already processed (idempotency)."""
    query = select(BillingEvent).where(BillingEvent.stripe_event_id == stripe_event_id)
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def record_billing_event(
    db: AsyncSession,
    stripe_event_id: str,
    event_type: str,
    status_value: str = "received"
) -> BillingEvent:
    """Record a billing event in the database."""
    event = BillingEvent(
        stripe_event_id=stripe_event_id,
        event_type=event_type,
        status=status_value,
        received_at=datetime.now(timezone.utc)
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def mark_event_processed(db: AsyncSession, event: BillingEvent) -> None:
    """Mark billing event as successfully processed."""
    event.status = "processed"
    event.processed_at = datetime.now(timezone.utc)
    db.add(event)


async def mark_event_failed(db: AsyncSession, event: BillingEvent) -> None:
    """Mark billing event as failed."""
    event.status = "failed"
    event.processed_at = datetime.now(timezone.utc)
    db.add(event)


async def retrieve_subscription(subscription_id: str) -> stripe.Subscription:
    """Retrieve a Stripe subscription."""
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return subscription
    except stripe.error.StripeError as e:
        logger.error(f"Failed to retrieve Stripe subscription {subscription_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Stripe subscription"
        )


async def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> stripe.Subscription:
    """Update a subscription to cancel at period end or immediately."""
    try:
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=at_period_end
        )
        logger.info(f"Canceled subscription {subscription_id} (at_period_end={at_period_end})")
        return subscription
    except stripe.error.StripeError as e:
        logger.error(f"Failed to cancel subscription {subscription_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


async def resume_subscription(subscription_id: str) -> stripe.Subscription:
    """Resume a subscription that was scheduled for cancellation at period end."""
    try:
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=False
        )
        logger.info(f"Resumed subscription {subscription_id}")
        return subscription
    except stripe.error.StripeError as e:
        logger.error(f"Failed to resume subscription {subscription_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume subscription"
        )


async def create_portal_session(customer_id: str, return_url: str) -> str:
    """Create a Stripe Billing Portal session."""
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url
        )
        logger.info(f"Created portal session for customer {customer_id}")
        return session.url
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create portal session for customer {customer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create billing portal session"
        )


SUBSCRIPTION_STATUS_MAP = {
    "active": "active",
    "trialing": "trialing",
    "past_due": "past_due",
    "unpaid": "past_due",
    "canceled": "cancelled",
    "incomplete": "paused",
    "incomplete_expired": "cancelled",
}


def normalize_subscription_status(stripe_status: Optional[str]) -> str:
    if not stripe_status:
        return "active"
    return SUBSCRIPTION_STATUS_MAP.get(stripe_status, "active")


async def get_organization_by_stripe_customer_id(
    db: AsyncSession,
    stripe_customer_id: str
) -> Optional[Organization]:
    """Get organization by Stripe customer ID."""
    query = select(Organization).where(Organization.stripe_customer_id == stripe_customer_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def handle_customer_created(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.created event."""
    customer = event_data["object"]
    customer_id = customer["id"]
    org_id_str = customer.get("metadata", {}).get("org_id")

    if not org_id_str:
        logger.warning(f"customer.created event missing org_id metadata: {customer_id}")
        return

    org_id = UUID(org_id_str)
    query = select(Organization).where(Organization.id == org_id)
    result = await db.execute(query)
    org = result.scalar_one_or_none()

    if org:
        org.stripe_customer_id = customer_id
        db.add(org)
        logger.info(f"Updated org {org_id} with Stripe customer {customer_id}")


async def handle_customer_updated(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.updated event."""
    customer = event_data["object"]
    customer_id = customer["id"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning(f"No org found for customer {customer_id} on update")
        return

    # Keep Stripe customer linkage intact (no other fields to sync yet)
    if not org.stripe_customer_id:
        org.stripe_customer_id = customer_id
        db.add(org)
        logger.info(f"Linked org {org.id} to Stripe customer {customer_id}")


async def handle_customer_deleted(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.deleted event."""
    customer = event_data["object"]
    customer_id = customer["id"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if org:
        org.billing_status = "canceled"
        org.subscription_status = "cancelled"
        db.add(org)
        logger.info(f"Marked org {org.id} as canceled (customer deleted)")


async def handle_subscription_created(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.created event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    subscription_id = subscription["id"]
    price_id = subscription["items"]["data"][0]["price"]["id"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning(f"No org found for customer {customer_id}")
        return

    plan = await get_plan_by_price_id(db, price_id)
    if plan:
        org.plan_id = plan.id

    org.stripe_subscription_id = subscription_id
    org.billing_status = "active"
    org.subscription_status = normalize_subscription_status(subscription.get("status"))
    db.add(org)
    logger.info(f"Subscription {subscription_id} created for org {org.id}")


async def handle_subscription_updated(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.updated event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    subscription_id = subscription["id"]
    price_id = subscription["items"]["data"][0]["price"]["id"]
    sub_status = subscription["status"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning(f"No org found for customer {customer_id}")
        return

    # Update plan if price changed
    plan = await get_plan_by_price_id(db, price_id)
    if plan:
        org.plan_id = plan.id

    # Map Stripe subscription status to billing_status
    billing_status_map = {
        "active": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "unpaid": "past_due",
        "incomplete": "billing_pending_review",
        "incomplete_expired": "canceled",
        "trialing": "trial_active",
    }
    org.billing_status = billing_status_map.get(sub_status, "billing_pending_review")
    org.subscription_status = normalize_subscription_status(sub_status)
    db.add(org)
    logger.info(f"Subscription {subscription_id} updated for org {org.id}: {sub_status}")


async def handle_subscription_trial_will_end(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.trial_will_end event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]
    trial_end = subscription.get("trial_end")

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning(f"No org found for customer {customer_id}")
        return

    if trial_end:
        org.trial_ends_at = datetime.utcfromtimestamp(trial_end)
        db.add(org)
        logger.info(f"Trial will end for org {org.id} at {org.trial_ends_at}")


async def handle_subscription_deleted(db: AsyncSession, event_data: dict) -> None:
    """Handle customer.subscription.deleted event."""
    subscription = event_data["object"]
    customer_id = subscription["customer"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if org:
        org.billing_status = "canceled"
        org.subscription_status = "cancelled"
        db.add(org)
        logger.info(f"Subscription deleted for org {org.id}")


async def handle_invoice_payment_succeeded(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.payment_succeeded event."""
    invoice = event_data["object"]
    customer_id = invoice["customer"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if org and org.billing_status == "past_due":
        org.billing_status = "active"
        org.subscription_status = "active"
        db.add(org)
        logger.info(f"Payment succeeded for org {org.id}, restored to active")


async def handle_invoice_payment_failed(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.payment_failed event."""
    invoice = event_data["object"]
    customer_id = invoice["customer"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if org:
        org.billing_status = "past_due"
        org.subscription_status = "past_due"
        db.add(org)
        logger.info(f"Payment failed for org {org.id}, set to past_due")


async def handle_checkout_session_completed(db: AsyncSession, event_data: dict) -> None:
    """Handle checkout.session.completed event."""
    session = event_data["object"]
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not customer_id:
        logger.warning("checkout.session.completed missing customer_id")
        return

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if org:
        if subscription_id:
            org.stripe_subscription_id = subscription_id
        org.billing_status = "active"
        org.subscription_status = "active"
        db.add(org)
        logger.info(f"Checkout completed for org {org.id}")


async def handle_invoice_finalized(db: AsyncSession, event_data: dict) -> None:
    """Handle invoice.finalized event."""
    invoice = event_data["object"]
    customer_id = invoice["customer"]

    org = await get_organization_by_stripe_customer_id(db, customer_id)
    if not org:
        logger.warning(f"No org found for customer {customer_id}")
        return

    # No billing_status change; keep for audit/logging
    logger.info(f"Invoice finalized for org {org.id}")


# Event handler mapping
EVENT_HANDLERS = {
    "customer.created": handle_customer_created,
    "customer.updated": handle_customer_updated,
    "customer.deleted": handle_customer_deleted,
    "customer.subscription.created": handle_subscription_created,
    "customer.subscription.updated": handle_subscription_updated,
    "customer.subscription.trial_will_end": handle_subscription_trial_will_end,
    "customer.subscription.deleted": handle_subscription_deleted,
    "invoice.finalized": handle_invoice_finalized,
    "invoice.payment_succeeded": handle_invoice_payment_succeeded,
    "invoice.payment_failed": handle_invoice_payment_failed,
    "checkout.session.completed": handle_checkout_session_completed,
}
