"""Billing service for InfinityPay integration."""
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.billing import BillingEvent, Plan, OrganizationUsage
from app.models.organizations import Organization
from app.services.infinity_pay import infinity_pay_service

logger = logging.getLogger(__name__)


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
    4. Create initial OrganizationUsage record
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
    
    # Initialize access_ends_at to trial end
    organization.access_ends_at = organization.trial_ends_at

    # Create initial usage record
    usage = OrganizationUsage(org_id=organization.id)
    db.add(usage)
    db.add(organization)

    logger.info(f"Set up 7-day trial for org {organization.id}, expires {organization.trial_ends_at}")


async def create_infinitypay_checkout_link(
    db: AsyncSession,
    organization: Organization,
    plan_name: str,
    redirect_url: str
) -> str:
    """
    Create an InfinityPay Checkout link for plan upgrade.

    Args:
        db: Database session
        organization: Organization upgrading
        plan_name: Plan name (e.g. 'starter', 'pro')
        redirect_url: URL to redirect on success

    Returns:
        Checkout URL
    """
    
    # Map plan names to details (Price in Cents)
    # TODO: Fetch from database or keep strict mapping here to avoid DB drift
    PLAN_DETAILS = {
        "starter": {"price": 3990, "description": "Starter Plan - 1 Month Access"},
        "pro": {"price": 8990, "description": "Pro Plan - 1 Month Access"},
        "pro_annual": {"price": 75500, "description": "Pro Plan - 1 Year Access"},
    }
    
    plan_info = PLAN_DETAILS.get(plan_name)
    if not plan_info:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan selected"
        )

    # Get the plan ID from DB to ensure validity
    query = select(Plan).where(Plan.name == plan_name)
    result = await db.execute(query)
    plan_db = result.scalar_one_or_none()
    
    if not plan_db:
         raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plan {plan_name} not found in database"
        )

    # Create InfinityPay payload
    items = [
        {
            "quantity": 1,
            "price": plan_info["price"],
            "description": plan_info["description"]
        }
    ]
    
    # Using org_id + timestamp as order_nsu to be unique
    order_nsu = f"{organization.id}_{int(datetime.now().timestamp())}"
    
    metadata = {
        "order_nsu": order_nsu,
        "org_id": str(organization.id),
        "plan_id": str(plan_db.id),
        "plan_name": plan_name
    }
    
    # Optional: fetch user data if available (e.g. billing contact)
    # keeping it simple for now
    
    try:
        url = await infinity_pay_service.create_checkout_link(
            items=items,
            metadata=metadata,
            redirect_url=redirect_url
        )
        return url
    except Exception as e:
        logger.error(f"Failed to create InfinityPay link: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to initiate payment provider"
        )


async def process_infinitypay_webhook(
    db: AsyncSession,
    payload: dict
) -> None:
    """
    Process InfinityPay webhook (payment approval).
    
    Expected logic:
    1. Parse payload
    2. Verify organization
    3. Update plan and access_ends_at
    """
    # Payload example:
    # {
    #   "invoice_slug": "abc123",
    #   "amount": 1000,
    #   "order_nsu": "UUID_TIMESTAMP",
    #   ...
    # }
    
    order_nsu = payload.get("order_nsu")
    if not order_nsu:
        logger.error("InfinityPay webhook missing order_nsu")
        return

    # Extract org_id from order_nsu (format: orgId_timestamp)
    try:
        org_id_str = order_nsu.split("_")[0]
        org_id = UUID(org_id_str)
    except Exception:
        logger.error(f"Malformed order_nsu: {order_nsu}")
        return

    query = select(Organization).where(Organization.id == org_id)
    result = await db.execute(query)
    organization = result.scalar_one_or_none()
    
    if not organization:
        logger.error(f"Organization not found for order_nsu: {order_nsu}")
        return
        
    # Extract verification details
    transaction_nsu = payload.get("transaction_nsu") # UUID of transaction
    invoice_slug = payload.get("invoice_slug") # Slug
    
    # 1. Zero Trust Verification
    if not transaction_nsu or not invoice_slug:
        logger.error("Missing verification fields (transaction_nsu/invoice_slug)")
        # We cannot verify, so we cannot trust this webhook
        return

    is_verified, transaction_data = await infinity_pay_service.verify_payment(
        transaction_id=transaction_nsu,
        order_nsu=order_nsu,
        slug=invoice_slug
    )
    
    if not is_verified:
        logger.warning(f"Payment verification FAILED for order {order_nsu}. Access denied.")
        return

    # 2. Ledgering (Audit Trail)
    # Check if we already processed this transaction to be idempotent
    # We can query BillingEvent by external_id = transaction_nsu
    query = select(BillingEvent).where(BillingEvent.external_id == transaction_nsu)
    result = await db.execute(query)
    existing_event = result.scalar_one_or_none()
    
    if existing_event:
        logger.info(f"Transaction {transaction_nsu} already processed.")
        return

    amount_cents = payload.get("amount", 0)
    paid_amount_cents = payload.get("paid_amount", 0)
    
    # Logic to determine plan details (kept from before, but safer)
    new_plan_name = "pro" 
    duration_days = 30
    
    if amount_cents == 3990:
        new_plan_name = "starter"
    elif amount_cents == 8990:
        new_plan_name = "pro"
    elif amount_cents == 75500:
        new_plan_name = "pro_annual"
        duration_days = 365
        
    # Create Ledger Entry
    ledger_entry = BillingEvent(
        organization_id=organization.id,
        event_type="payment_success",
        plan_name=new_plan_name,
        amount_cents=paid_amount_cents,
        currency="BRL",
        status="succeeded",
        provider="infinitypay",
        external_id=transaction_nsu,
        metadata={
            "order_nsu": order_nsu,
            "invoice_slug": invoice_slug,
            "capture_method": payload.get("capture_method"),
            "installments": payload.get("installments"),
            "full_verification_data": transaction_data
        }
    )
    db.add(ledger_entry)

    # 3. Grant Access
    query = select(Plan).where(Plan.name == new_plan_name)
    result = await db.execute(query)
    plan_db = result.scalar_one_or_none()
    
    if plan_db:
        organization.plan_id = plan_db.id
        organization.plan = new_plan_name
        
    now = datetime.now(timezone.utc)
    
    if organization.access_ends_at and organization.access_ends_at > now:
        organization.access_ends_at += timedelta(days=duration_days)
    else:
        organization.access_ends_at = now + timedelta(days=duration_days)
        
    organization.billing_status = "active"
    organization.subscription_status = "active"
    
    db.add(organization)
    await db.commit() # Commit explicitly here to save ledger and org update together
    
    logger.info(f"Verified & Processed InfinityPay payment {transaction_nsu} for org {organization.id}.")


# Helper to check access
def has_active_access(organization: Organization) -> bool:
    """Check if organization has active paid access or trial."""
    now = datetime.now(timezone.utc)
    
    # Check manual access date (Pre-paid)
    if organization.access_ends_at and organization.access_ends_at > now:
        return True
        
    # Check legacy/trial
    if organization.trial_ends_at and organization.trial_ends_at > now:
        return True
        
    return False
