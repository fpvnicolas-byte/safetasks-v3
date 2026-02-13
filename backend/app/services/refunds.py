from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.refunds import BillingPurchase, RefundRequest
from fastapi import HTTPException, status

class RefundEligibilityService:
    @staticmethod
    def get_max_refundable_cents(
        purchase: BillingPurchase,
        consumed_usage_cents: int = 0,
    ) -> int:
        """
        Calculate the production-safe maximum refundable amount.
        Formula:
        clamp(
            amount_paid - total_already_refunded - consumed_usage_value,
            0,
            amount_paid - total_already_refunded
        )
        """
        remaining_cap = max(0, purchase.amount_paid_cents - purchase.total_refunded_cents)
        raw_refund = purchase.amount_paid_cents - purchase.total_refunded_cents - max(0, consumed_usage_cents)
        return max(0, min(remaining_cap, raw_refund))

    @staticmethod
    def calculate_prorated_usage(purchase: BillingPurchase) -> int:
        """
        Calculate value of consumed usage based on time proration.
        
        Strategy:
        1. Parse plan duration (monthly=30, annual=365).
        2. Calculate days used since `paid_at`.
        3. Value = (Days Used / Total Days) * Amount Paid.
        """
        if not purchase.plan_name:
            return 0

        duration_days = 365 if "annual" in purchase.plan_name else 30
            
        now = datetime.now(timezone.utc)
        
        # Ensure paid_at is aware
        paid_at = purchase.paid_at
        if paid_at.tzinfo is None:
            paid_at = paid_at.replace(tzinfo=timezone.utc)
            
        time_diff = now - paid_at
        days_used = max(0, time_diff.days)
        
        if days_used >= duration_days:
            return purchase.amount_paid_cents # 100% used
            
        usage_ratio = days_used / duration_days
        return int(purchase.amount_paid_cents * usage_ratio)

    @staticmethod
    def check_eligibility(purchase: BillingPurchase) -> Tuple[bool, str, Optional[datetime]]:
        """
        Check if purchase is eligible for refund.
        Returns: (is_eligible, reason, eligible_until_date)
        """
        # 1. Check strict 7-day window
        # paid_at + 7 days
        paid_at = purchase.paid_at
        if paid_at.tzinfo is None:
            paid_at = paid_at.replace(tzinfo=timezone.utc)
            
        eligible_until = paid_at + timedelta(days=7)
        now = datetime.now(timezone.utc)
        
        if now > eligible_until:
            return False, "outside_7_day_window", eligible_until
            
        # 2. Check if fully refunded
        if purchase.total_refunded_cents >= purchase.amount_paid_cents:
             return False, "already_fully_refunded", eligible_until

        return True, "eligible", eligible_until

    @staticmethod
    async def validate_duplicate_request(db: AsyncSession, purchase_id: UUID) -> None:
        """
        Ensure only one refund request can ever exist for the purchase.
        """
        query = select(RefundRequest).where(
            RefundRequest.purchase_id == purchase_id
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
             raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A refund request already exists for this purchase."
            )

refund_eligibility_service = RefundEligibilityService()
