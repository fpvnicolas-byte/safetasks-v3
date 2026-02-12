import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

# Add parent dir to path for app imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.organizations import Organization
from app.models.platform import PlatformAdminUser
from app.models.profiles import Profile
from app.models.refunds import (
    BillingPurchase,
    RefundEvent,
    RefundRequest,
    RefundTransaction,
)


def _parse_uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    return UUID(value)


def _calc_max_refund(amount_paid_cents: int, total_refunded_cents: int, consumed_usage_cents: int) -> int:
    remaining_cap = max(0, amount_paid_cents - total_refunded_cents)
    raw = amount_paid_cents - total_refunded_cents - max(0, consumed_usage_cents)
    return max(0, min(remaining_cap, raw))


async def _resolve_profile(
    email: str | None,
    profile_id: UUID | None,
    org_id: UUID | None,
) -> tuple[Profile, UUID]:
    async with SessionLocal() as db:
        profile: Profile | None = None

        if profile_id:
            result = await db.execute(select(Profile).where(Profile.id == profile_id))
            profile = result.scalar_one_or_none()
            if not profile:
                raise RuntimeError(f"Profile not found for id={profile_id}")

        elif email:
            result = await db.execute(select(Profile).where(Profile.email.ilike(email)))
            profile = result.scalar_one_or_none()
            if not profile:
                raise RuntimeError(f"Profile not found for email={email}")

        elif org_id:
            result = await db.execute(
                select(Profile)
                .where(Profile.organization_id == org_id)
                .order_by(Profile.created_at.asc())
                .limit(1)
            )
            profile = result.scalar_one_or_none()
            if not profile:
                raise RuntimeError(f"No profile found in organization id={org_id}")

        else:
            result = await db.execute(
                select(Profile)
                .where(Profile.organization_id.isnot(None))
                .order_by(Profile.created_at.asc())
                .limit(1)
            )
            profile = result.scalar_one_or_none()
            if not profile:
                raise RuntimeError(
                    "No profile with organization found. Log in once and create an organization first."
                )

        if not profile.organization_id:
            raise RuntimeError("Resolved profile has no organization_id.")

        org_result = await db.execute(
            select(Organization).where(Organization.id == profile.organization_id)
        )
        org = org_result.scalar_one_or_none()
        if not org:
            raise RuntimeError(f"Organization not found id={profile.organization_id}")

        return profile, profile.organization_id


async def seed_refund_demo(
    email: str | None,
    profile_id: UUID | None,
    org_id: UUID | None,
    include_platform_admin: bool,
) -> None:
    profile, resolved_org_id = await _resolve_profile(email, profile_id, org_id)
    now = datetime.now(timezone.utc)

    async with SessionLocal() as db:
        # Refresh profile/org inside current session
        profile_result = await db.execute(select(Profile).where(Profile.id == profile.id))
        profile_in_db = profile_result.scalar_one()

        # Optionally grant platform access for local testing
        if include_platform_admin:
            admin_result = await db.execute(
                select(PlatformAdminUser).where(PlatformAdminUser.profile_id == profile_in_db.id)
            )
            admin_row = admin_result.scalar_one_or_none()
            if admin_row is None:
                db.add(
                    PlatformAdminUser(
                        profile_id=profile_in_db.id,
                        role="superadmin",
                        is_active=True,
                    )
                )
            elif not admin_row.is_active:
                admin_row.is_active = True
                db.add(admin_row)

        demo_specs = [
            # Status: requested
            {
                "plan_name": "professional",
                "amount_paid_cents": 8990,
                "days_ago": 2,
                "total_refunded_cents": 0,
                "status": "requested",
                "consumed_usage_cents": 1200,
                "approved_amount_cents": None,
                "reason_code": "demo_requested",
                "reason_detail": "Demo: user asked refund in first 7 days",
            },
            # Status: processing (approved, awaiting manual execution)
            {
                "plan_name": "starter",
                "amount_paid_cents": 3990,
                "days_ago": 3,
                "total_refunded_cents": 0,
                "status": "processing",
                "consumed_usage_cents": 500,
                "approved_amount_cents": 1500,
                "reason_code": "demo_processing",
                "reason_detail": "Demo: approved and waiting provider execution",
            },
            # Status: refunded (manual execution confirmed)
            {
                "plan_name": "professional",
                "amount_paid_cents": 8990,
                "days_ago": 5,
                "total_refunded_cents": 2000,
                "status": "refunded",
                "consumed_usage_cents": 1500,
                "approved_amount_cents": 2000,
                "reason_code": "demo_refunded",
                "reason_detail": "Demo: already refunded",
            },
        ]

        created_purchase_ids: list[UUID] = []
        created_request_ids: list[UUID] = []

        for index, spec in enumerate(demo_specs, start=1):
            paid_at = now - timedelta(days=spec["days_ago"])
            purchase = BillingPurchase(
                organization_id=resolved_org_id,
                provider="infinitypay",
                external_charge_id=f"demo_refund_{uuid4().hex[:12]}",
                plan_name=spec["plan_name"],
                amount_paid_cents=spec["amount_paid_cents"],
                currency="BRL",
                paid_at=paid_at,
                total_refunded_cents=spec["total_refunded_cents"],
            )
            db.add(purchase)
            await db.flush()

            calculated_max_refund = _calc_max_refund(
                amount_paid_cents=spec["amount_paid_cents"],
                total_refunded_cents=spec["total_refunded_cents"],
                consumed_usage_cents=spec["consumed_usage_cents"],
            )
            eligible_until = paid_at + timedelta(days=7)
            requested_at = paid_at + timedelta(hours=2)
            status = spec["status"]
            approved_amount_cents = spec["approved_amount_cents"]

            decided_at = None
            processed_at = None
            if status in {"processing", "rejected", "refunded"}:
                decided_at = requested_at + timedelta(hours=3)
            if status == "refunded":
                processed_at = requested_at + timedelta(hours=5)

            request = RefundRequest(
                purchase_id=purchase.id,
                organization_id=resolved_org_id,
                requester_profile_id=profile_in_db.id,
                status=status,
                reason_code=spec["reason_code"],
                reason_detail=spec["reason_detail"],
                amount_paid_cents=spec["amount_paid_cents"],
                consumed_usage_value_cents=spec["consumed_usage_cents"],
                calculated_max_refund_cents=calculated_max_refund,
                approved_amount_cents=approved_amount_cents,
                eligible_until=eligible_until,
                requested_at=requested_at,
                decided_at=decided_at,
                processed_at=processed_at,
            )
            db.add(request)
            await db.flush()

            # Always add "created" event
            db.add(
                RefundEvent(
                    refund_request_id=request.id,
                    actor_type="user",
                    actor_id=profile_in_db.id,
                    event_type="created",
                    event_metadata={"seed": True, "index": index},
                )
            )

            # Status-specific events and transaction
            if status in {"processing", "refunded"}:
                db.add(
                    RefundEvent(
                        refund_request_id=request.id,
                        actor_type="platform_admin",
                        actor_id=profile_in_db.id,
                        event_type="approved",
                        event_metadata={"approved_amount_cents": approved_amount_cents, "seed": True},
                    )
                )

            if status == "refunded":
                db.add(
                    RefundTransaction(
                        refund_request_id=request.id,
                        provider="infinitypay",
                        provider_refund_id=f"demo_rf_{uuid4().hex[:10]}",
                        amount_cents=approved_amount_cents or 0,
                        status="succeeded",
                        requested_at=requested_at + timedelta(hours=4),
                        completed_at=processed_at,
                    )
                )
                db.add(
                    RefundEvent(
                        refund_request_id=request.id,
                        actor_type="platform_admin",
                        actor_id=profile_in_db.id,
                        event_type="refunded_manually",
                        event_metadata={"seed": True},
                    )
                )

            created_purchase_ids.append(purchase.id)
            created_request_ids.append(request.id)

        await db.commit()

    print("\nDemo refund data created successfully.")
    print(f"Organization: {resolved_org_id}")
    print(f"Profile: {profile.id} ({profile.email})")
    print("Purchases:")
    for purchase_id in created_purchase_ids:
        print(f"  - {purchase_id}")
    print("Refund Requests:")
    for request_id in created_request_ids:
        print(f"  - {request_id}")
    print("\nOpen:")
    print("  - /en/settings/billing")
    print("  - /en/platform/refunds")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed demo billing_purchases + refund_requests for local refund UI testing."
    )
    parser.add_argument("--email", help="Profile email to use as requester and seeded platform admin")
    parser.add_argument("--profile-id", help="Profile UUID to use")
    parser.add_argument("--org-id", help="Organization UUID to target (uses first profile in org)")
    parser.add_argument(
        "--skip-platform-admin",
        action="store_true",
        help="Do not grant/re-activate platform admin for the selected profile",
    )
    args = parser.parse_args()

    asyncio.run(
        seed_refund_demo(
            email=args.email,
            profile_id=_parse_uuid(args.profile_id),
            org_id=_parse_uuid(args.org_id),
            include_platform_admin=not args.skip_platform_admin,
        )
    )


if __name__ == "__main__":
    main()
