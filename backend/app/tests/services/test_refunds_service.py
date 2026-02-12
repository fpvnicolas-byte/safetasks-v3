from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.refunds import RefundEligibilityService


def _purchase(
    *,
    amount_paid_cents: int = 10000,
    total_refunded_cents: int = 0,
    plan_name: str = "professional",
    paid_at: datetime | None = None,
):
    if paid_at is None:
        paid_at = datetime.now(timezone.utc)
    return SimpleNamespace(
        amount_paid_cents=amount_paid_cents,
        total_refunded_cents=total_refunded_cents,
        plan_name=plan_name,
        paid_at=paid_at,
    )


def test_get_max_refundable_cents_applies_usage_and_clamp():
    purchase = _purchase(amount_paid_cents=10000, total_refunded_cents=1000)

    # 10000 - 1000 - 1500 = 7500
    assert (
        RefundEligibilityService.get_max_refundable_cents(
            purchase,
            consumed_usage_cents=1500,
        )
        == 7500
    )

    # Cannot exceed remaining cap (9000) and cannot go below 0.
    assert (
        RefundEligibilityService.get_max_refundable_cents(
            purchase,
            consumed_usage_cents=20000,
        )
        == 0
    )


def test_calculate_prorated_usage_annual_plan():
    paid_at = datetime.now(timezone.utc) - timedelta(days=30)
    purchase = _purchase(
        amount_paid_cents=36500,
        plan_name="professional_annual",
        paid_at=paid_at,
    )
    usage = RefundEligibilityService.calculate_prorated_usage(purchase)

    # 30/365 ~= 8.2%
    assert 2500 <= usage <= 3500


def test_check_eligibility_within_7_days():
    paid_at = datetime.now(timezone.utc) - timedelta(days=3)
    purchase = _purchase(paid_at=paid_at)

    eligible, reason, eligible_until = RefundEligibilityService.check_eligibility(purchase)
    assert eligible is True
    assert reason == "eligible"
    assert eligible_until == paid_at + timedelta(days=7)


def test_check_eligibility_outside_7_days():
    paid_at = datetime.now(timezone.utc) - timedelta(days=8)
    purchase = _purchase(paid_at=paid_at)

    eligible, reason, _ = RefundEligibilityService.check_eligibility(purchase)
    assert eligible is False
    assert reason == "outside_7_day_window"

