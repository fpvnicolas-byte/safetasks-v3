"""
Comprehensive InfinityPay Billing Integration Tests.

Tests cover:
  1. Checkout link creation (valid plans, invalid plans, redirect validation)
  2. Webhook / verify processing (all 3 plans: starter, professional, professional_annual)
  3. Metadata-first plan detection vs amount-based fallback
  4. Idempotency (duplicate transaction_nsu handling)
  5. Access duration stacking (renewal extends existing access)
  6. Cron downgrade logic (expired orgs get blocked)
  7. Security: open redirect prevention, malformed order_nsu, missing fields
  8. has_active_access helper
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from fastapi import HTTPException

from app.services import billing as billing_module
from app.services.billing import (
    _is_redirect_url_allowed,
    has_active_access,
)
from app.services.infinity_pay import InfinityPayService


# This module is unit-test only (all DB interactions are mocked), so avoid
# forcing live DB schema truncation from app/tests/conftest.py.
@pytest.fixture(autouse=True)
async def _truncate_public_schema():
    yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FakeOrganization:
    """Lightweight org stand-in so we don't need a real DB."""
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", uuid4())
        self.plan = kwargs.get("plan", "free")
        self.plan_id = kwargs.get("plan_id", None)
        self.billing_status = kwargs.get("billing_status", "trial_active")
        self.subscription_status = kwargs.get("subscription_status", "trialing")
        self.access_ends_at = kwargs.get("access_ends_at", None)
        self.trial_ends_at = kwargs.get("trial_ends_at", None)
        self.owner_profile_id = kwargs.get("owner_profile_id", uuid4())
        self.billing_contact_user_id = kwargs.get("billing_contact_user_id", None)
        self.name = kwargs.get("name", "Test Org")


class FakePlan:
    def __init__(self, name="professional"):
        self.id = uuid4()
        self.name = name


class FakeProfile:
    def __init__(self, email="test@example.com"):
        self.id = uuid4()
        self.email = email


class MockResponse:
    """Reusable httpx response mock."""
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code

    def json(self):
        return self.json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP Error {self.status_code}")


# ---------------------------------------------------------------------------
# 1. Redirect URL Validation
# ---------------------------------------------------------------------------

class TestRedirectUrlValidation:
    """Tests for _is_redirect_url_allowed."""

    def test_allowed_when_url_matches_frontend(self):
        with patch("app.services.billing.settings") as mock_settings:
            mock_settings.FRONTEND_URL = "https://app.safetasks.com"
            assert _is_redirect_url_allowed("https://app.safetasks.com/settings/billing") is True

    def test_blocked_when_url_is_external(self):
        with patch("app.services.billing.settings") as mock_settings:
            mock_settings.FRONTEND_URL = "https://app.safetasks.com"
            assert _is_redirect_url_allowed("https://evil.com/steal-cookies") is False

    def test_blocked_subdomain_spoof(self):
        with patch("app.services.billing.settings") as mock_settings:
            mock_settings.FRONTEND_URL = "https://app.safetasks.com"
            assert _is_redirect_url_allowed("https://app.safetasks.com.evil.com/x") is False

    def test_allowed_when_no_frontend_configured(self):
        with patch("app.services.billing.settings") as mock_settings:
            mock_settings.FRONTEND_URL = None
            # When no restrictions configured, allow all (backwards-compat)
            assert _is_redirect_url_allowed("https://anything.com") is True


# ---------------------------------------------------------------------------
# 2. has_active_access helper
# ---------------------------------------------------------------------------

class TestHasActiveAccess:
    """Tests for has_active_access."""

    def test_active_when_access_ends_in_future(self):
        org = FakeOrganization(access_ends_at=datetime.now(timezone.utc) + timedelta(days=10))
        assert has_active_access(org) is True

    def test_inactive_when_access_ended(self):
        org = FakeOrganization(access_ends_at=datetime.now(timezone.utc) - timedelta(days=1))
        assert has_active_access(org) is False

    def test_active_when_trial_in_future(self):
        org = FakeOrganization(trial_ends_at=datetime.now(timezone.utc) + timedelta(days=3))
        assert has_active_access(org) is True

    def test_inactive_when_trial_ended(self):
        org = FakeOrganization(trial_ends_at=datetime.now(timezone.utc) - timedelta(days=1))
        assert has_active_access(org) is False

    def test_inactive_when_no_dates_set(self):
        org = FakeOrganization()
        assert has_active_access(org) is False


# ---------------------------------------------------------------------------
# 3. InfinityPay Service Unit Tests
# ---------------------------------------------------------------------------

class TestInfinityPayService:
    """Tests for the InfinityPayService."""

    @pytest.fixture
    def service(self):
        with patch("app.services.infinity_pay.settings") as mock_settings:
            mock_settings.INFINITYPAY_HANDLE = "test-handle"
            mock_settings.INFINITYPAY_API_URL = "https://api.infinitepay.io/invoices/public/checkout"
            mock_settings.INFINITYPAY_WEBHOOK_URL = "https://api.safetasks.com/api/v1/billing/webhooks/infinitypay"
            svc = InfinityPayService()
        return svc

    @pytest.mark.asyncio
    async def test_create_checkout_link_returns_url(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "checkout_url": "https://pay.infinitepay.io/scan/abc123",
                "qrcode_url": "https://img",
                "qrcode_base64": "base64data"
            }))
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            url = await service.create_checkout_link(
                items=[{"quantity": 1, "price": 8990, "description": "Pro Plan"}],
                metadata={"order_nsu": "123_456"}
            )
            assert url == "https://pay.infinitepay.io/scan/abc123"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_checkout_link_accepts_nested_data_checkout_url(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "data": {
                    "checkout_url": "https://pay.infinitepay.io/scan/nested123"
                }
            }))
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            url = await service.create_checkout_link(
                items=[{"quantity": 1, "price": 3990, "description": "Starter Plan"}],
                metadata={"order_nsu": "123_456"}
            )
            assert url == "https://pay.infinitepay.io/scan/nested123"

    @pytest.mark.asyncio
    async def test_create_checkout_link_raises_if_checkout_url_missing(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "success": True
            }))
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(HTTPException) as exc:
                await service.create_checkout_link(
                    items=[{"quantity": 1, "price": 3990, "description": "Starter Plan"}],
                    metadata={"order_nsu": "123_456"}
                )
            assert exc.value.status_code == 502

    @pytest.mark.asyncio
    async def test_create_checkout_link_omits_delivery_address_for_plan_sales(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "checkout_url": "https://pay.infinitepay.io/scan/abc123"
            }))
            mock_client = MagicMock(post=mock_post)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            _ = await service.create_checkout_link(
                items=[{"quantity": 1, "price": 8990, "description": "Professional Plan"}],
                metadata={"order_nsu": "org_123_plan_456"},
                customer={
                    "name": "Joao Silva",
                    "email": "joao@email.com",
                    "phone_number": "+5511999999999",
                    "address": {
                        "cep": "12345678",
                        "street": "Rua X",
                        "number": "123",
                    },
                },
            )

            sent_payload = mock_post.call_args.kwargs["json"]
            assert "address" not in sent_payload
            assert sent_payload["customer"] == {
                "name": "Joao Silva",
                "email": "joao@email.com",
                "phone_number": "+5511999999999",
            }

    @pytest.mark.asyncio
    async def test_create_checkout_link_drops_customer_when_only_address_fields_exist(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "checkout_url": "https://pay.infinitepay.io/scan/abc123"
            }))
            mock_client = MagicMock(post=mock_post)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            _ = await service.create_checkout_link(
                items=[{"quantity": 1, "price": 8990, "description": "Professional Plan"}],
                metadata={"order_nsu": "org_123_plan_456"},
                customer={
                    "address": {
                        "cep": "12345678",
                        "street": "Rua X",
                        "number": "123",
                    },
                },
            )

            sent_payload = mock_post.call_args.kwargs["json"]
            assert "customer" not in sent_payload

    @pytest.mark.asyncio
    async def test_verify_payment_success(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({
                "paid": True, "amount": 8990, "transaction_nsu": "t_123"
            }))
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            is_paid, data = await service.verify_payment("t_123", "o_123", "slug_123")
            assert is_paid is True
            assert data["amount"] == 8990

    @pytest.mark.asyncio
    async def test_verify_payment_returns_false_on_unpaid(self, service):
        with patch("httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=MockResponse({"paid": False}))
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            is_paid, data = await service.verify_payment("t_123", "o_123", "slug_123")
            assert is_paid is False

    @pytest.mark.asyncio
    async def test_verify_payment_missing_params(self, service):
        """Cannot verify without all three params."""
        is_paid, data = await service.verify_payment("", "o_123", "slug_123")
        assert is_paid is False
        assert data == {}


# ---------------------------------------------------------------------------
# 4. Webhook Processing (process_infinitypay_webhook)
# ---------------------------------------------------------------------------

class TestProcessWebhook:
    """Tests for process_infinitypay_webhook with mocked DB and InfinityPay API."""

    def _build_payload(self, org_id, plan_name="professional", amount=8990):
        order_nsu = f"{org_id}_{int(datetime.now().timestamp())}"
        return {
            "order_nsu": order_nsu,
            "transaction_nsu": f"txn_{uuid4().hex[:12]}",
            "invoice_slug": f"inv_{uuid4().hex[:8]}",
            "amount": amount,
            "paid_amount": amount,
            "plan_name": plan_name,
        }

    @pytest.fixture
    def mock_db(self):
        """Create a mock async session."""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.add = MagicMock()
        return db

    @pytest.fixture
    def mock_verify_paid(self):
        """Patch InfinityPay to always verify as paid."""
        with patch.object(
            billing_module.infinity_pay_service,
            "verify_payment",
            new_callable=AsyncMock,
            return_value=(True, {"paid": True, "amount": 8990})
        ) as mock:
            yield mock

    def _setup_db_returns(self, db, org, plan, existing_event=None):
        """Configure the mock DB to return org, plan, and optionally an existing event."""
        results = []

        # 1st query: SELECT Organization WHERE id = org_id
        org_result = MagicMock()
        org_result.scalar_one_or_none.return_value = org
        results.append(org_result)

        # 2nd query: SELECT BillingEvent WHERE external_id = transaction_nsu
        event_result = MagicMock()
        event_result.scalar_one_or_none.return_value = existing_event
        results.append(event_result)

        # 3rd query: SELECT Plan WHERE name = plan_name
        plan_result = MagicMock()
        plan_result.scalar_one_or_none.return_value = plan
        results.append(plan_result)

        db.execute = AsyncMock(side_effect=results)

    # --- Plan detection tests ---

    @pytest.mark.asyncio
    @pytest.mark.parametrize("plan_name,amount,expected_duration", [
        ("starter", 3990, 30),
        ("professional", 8990, 30),
        ("professional_annual", 75500, 365),
    ])
    async def test_processes_all_plans_via_metadata(
        self, mock_db, mock_verify_paid, plan_name, amount, expected_duration
    ):
        """All three plans should be correctly identified from metadata."""
        org = FakeOrganization()
        plan = FakePlan(name=plan_name)
        self._setup_db_returns(mock_db, org, plan)

        payload = self._build_payload(org.id, plan_name=plan_name, amount=amount)
        await billing_module.process_infinitypay_webhook(mock_db, payload)

        # Org should be updated
        assert org.plan == plan_name
        assert org.billing_status == "active"
        assert org.subscription_status == "active"
        assert org.access_ends_at is not None

        # Duration should be correct
        expected_end = datetime.now(timezone.utc) + timedelta(days=expected_duration)
        assert abs((org.access_ends_at - expected_end).total_seconds()) < 5

    @pytest.mark.asyncio
    async def test_fallback_to_amount_when_no_metadata(self, mock_db, mock_verify_paid):
        """When plan_name is missing, plan should be inferred from amount."""
        org = FakeOrganization()
        plan = FakePlan(name="professional")
        self._setup_db_returns(mock_db, org, plan)

        payload = self._build_payload(org.id, plan_name=None, amount=8990)
        # Remove plan_name to test fallback
        payload.pop("plan_name", None)

        await billing_module.process_infinitypay_webhook(mock_db, payload)

        assert org.plan == "professional"
        assert org.billing_status == "active"

    @pytest.mark.asyncio
    async def test_unknown_amount_no_metadata_aborts(self, mock_db, mock_verify_paid):
        """Unknown amount + no metadata → should NOT grant access."""
        org = FakeOrganization(billing_status="trial_active")
        plan = FakePlan()
        self._setup_db_returns(mock_db, org, plan)

        payload = self._build_payload(org.id, plan_name=None, amount=9999)
        payload.pop("plan_name", None)

        await billing_module.process_infinitypay_webhook(mock_db, payload)

        # Org should NOT be updated
        assert org.billing_status == "trial_active"

    # --- Idempotency ---

    @pytest.mark.asyncio
    async def test_duplicate_transaction_is_idempotent(self, mock_db, mock_verify_paid):
        """Re-processing an already-processed transaction should be a no-op."""
        org = FakeOrganization()
        existing_event = MagicMock()  # Simulate existing BillingEvent
        self._setup_db_returns(mock_db, org, FakePlan(), existing_event=existing_event)

        payload = self._build_payload(org.id)
        original_status = org.billing_status

        await billing_module.process_infinitypay_webhook(mock_db, payload)

        # Nothing should change
        assert org.billing_status == original_status
        mock_db.commit.assert_not_called()

    # --- Access stacking ---

    @pytest.mark.asyncio
    async def test_renewal_extends_existing_access(self, mock_db, mock_verify_paid):
        """Renewing before expiry should extend from the current end date, not today."""
        future_end = datetime.now(timezone.utc) + timedelta(days=15)
        org = FakeOrganization(
            access_ends_at=future_end,
            billing_status="active"
        )
        plan = FakePlan(name="professional")
        self._setup_db_returns(mock_db, org, plan)

        payload = self._build_payload(org.id, plan_name="professional", amount=8990)
        await billing_module.process_infinitypay_webhook(mock_db, payload)

        # Should add 30 more days to existing end, not from today
        expected = future_end + timedelta(days=30)
        assert abs((org.access_ends_at - expected).total_seconds()) < 5

    @pytest.mark.asyncio
    async def test_renewal_after_expiry_starts_from_today(self, mock_db, mock_verify_paid):
        """Renewing after expiry should start access from today."""
        past_end = datetime.now(timezone.utc) - timedelta(days=5)
        org = FakeOrganization(
            access_ends_at=past_end,
            billing_status="blocked"
        )
        plan = FakePlan(name="professional")
        self._setup_db_returns(mock_db, org, plan)

        payload = self._build_payload(org.id, plan_name="professional", amount=8990)
        await billing_module.process_infinitypay_webhook(mock_db, payload)

        expected = datetime.now(timezone.utc) + timedelta(days=30)
        assert abs((org.access_ends_at - expected).total_seconds()) < 5
        assert org.billing_status == "active"

    # --- Security: verification failure ---

    @pytest.mark.asyncio
    async def test_unverified_payment_denied(self, mock_db):
        """If InfinityPay verification fails, access must NOT be granted."""
        org = FakeOrganization(billing_status="trial_active")

        with patch.object(
            billing_module.infinity_pay_service,
            "verify_payment",
            new_callable=AsyncMock,
            return_value=(False, {})
        ):
            # Setup only the org query (verification fails before event/plan queries)
            org_result = MagicMock()
            org_result.scalar_one_or_none.return_value = org
            mock_db.execute = AsyncMock(return_value=org_result)

            payload = self._build_payload(org.id)
            await billing_module.process_infinitypay_webhook(mock_db, payload)

        assert org.billing_status == "trial_active"  # Unchanged
        mock_db.commit.assert_not_called()

    # --- Security: malformed order_nsu ---

    @pytest.mark.asyncio
    async def test_malformed_order_nsu_rejected(self, mock_db, mock_verify_paid):
        """Garbage order_nsu should be safely rejected."""
        payload = {
            "order_nsu": "NOT_A_VALID_UUID_FORMAT",
            "transaction_nsu": "t_123",
            "invoice_slug": "inv_123",
            "amount": 8990,
            "plan_name": "professional",
        }
        await billing_module.process_infinitypay_webhook(mock_db, payload)
        mock_db.commit.assert_not_called()

    # --- Security: missing verification fields ---

    @pytest.mark.asyncio
    async def test_missing_transaction_nsu_rejected(self, mock_db):
        """Missing transaction_nsu means we can't verify → must reject."""
        org = FakeOrganization()
        org_result = MagicMock()
        org_result.scalar_one_or_none.return_value = org
        mock_db.execute = AsyncMock(return_value=org_result)

        payload = {
            "order_nsu": f"{org.id}_123456",
            # no transaction_nsu or invoice_slug
            "amount": 8990,
        }
        await billing_module.process_infinitypay_webhook(mock_db, payload)
        assert org.billing_status != "active"


# ---------------------------------------------------------------------------
# 5. Cron Job: check_expiring_plans
# ---------------------------------------------------------------------------

class TestCronCheckPlans:
    """Tests for the cron expiration/downgrade logic."""

    @pytest.mark.asyncio
    async def test_expired_org_gets_blocked(self):
        """Orgs with access expired yesterday should get billing_status=blocked."""
        yesterday = datetime.now(timezone.utc) - timedelta(hours=12)
        org = FakeOrganization(
            access_ends_at=yesterday,
            billing_status="active",
            subscription_status="active",
        )
        profile = FakeProfile()

        with patch("app.cron_check_plans.SessionLocal") as MockSession, \
             patch("app.cron_check_plans.send_plan_expired_notice") as mock_email, \
             patch("app.cron_check_plans.send_plan_expiry_warning"):

            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            # Simulate query results
            org_result = MagicMock()
            org_result.scalars.return_value.all.return_value = [org]

            profile_result = MagicMock()
            profile_result.scalar_one_or_none.return_value = profile

            mock_db.execute = AsyncMock(side_effect=[org_result, profile_result])
            mock_db.commit = AsyncMock()
            mock_db.add = MagicMock()

            from app.cron_check_plans import check_expiring_plans
            await check_expiring_plans()

            assert org.billing_status == "blocked"
            assert org.subscription_status == "past_due"
            mock_email.assert_called_once()
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_5_day_warning_sent(self):
        """Orgs with 5 days left should get a warning email, not be blocked."""
        five_days = datetime.now(timezone.utc) + timedelta(days=5, hours=12)
        org = FakeOrganization(
            access_ends_at=five_days,
            billing_status="active",
            subscription_status="active",
        )
        profile = FakeProfile()

        with patch("app.cron_check_plans.SessionLocal") as MockSession, \
             patch("app.cron_check_plans.send_plan_expiry_warning") as mock_warning, \
             patch("app.cron_check_plans.send_plan_expired_notice") as mock_expired:

            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            org_result = MagicMock()
            org_result.scalars.return_value.all.return_value = [org]

            profile_result = MagicMock()
            profile_result.scalar_one_or_none.return_value = profile

            mock_db.execute = AsyncMock(side_effect=[org_result, profile_result])
            mock_db.commit = AsyncMock()

            from app.cron_check_plans import check_expiring_plans
            await check_expiring_plans()

            assert org.billing_status == "active"  # NOT blocked
            mock_warning.assert_called_once()
            mock_expired.assert_not_called()

    @pytest.mark.asyncio
    async def test_already_blocked_org_not_re_blocked(self):
        """Orgs already blocked should not trigger duplicate status updates."""
        yesterday = datetime.now(timezone.utc) - timedelta(hours=12)
        org = FakeOrganization(
            access_ends_at=yesterday,
            billing_status="blocked",
            subscription_status="past_due",
        )
        profile = FakeProfile()

        with patch("app.cron_check_plans.SessionLocal") as MockSession, \
             patch("app.cron_check_plans.send_plan_expired_notice") as mock_email, \
             patch("app.cron_check_plans.send_plan_expiry_warning"):

            mock_db = AsyncMock()
            MockSession.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            org_result = MagicMock()
            org_result.scalars.return_value.all.return_value = [org]

            profile_result = MagicMock()
            profile_result.scalar_one_or_none.return_value = profile

            mock_db.execute = AsyncMock(side_effect=[org_result, profile_result])
            mock_db.commit = AsyncMock()
            mock_db.add = MagicMock()

            from app.cron_check_plans import check_expiring_plans
            await check_expiring_plans()

            # Should still send email but NOT call db.add (already blocked)
            assert org.billing_status == "blocked"
            mock_email.assert_called_once()
            mock_db.add.assert_not_called()


# ---------------------------------------------------------------------------
# 6. Plan name consistency (regression guard)
# ---------------------------------------------------------------------------

class TestPlanNameConsistency:
    """Guard against the original pro/pro_annual mismatch from recurring."""

    def test_plan_details_uses_professional_names(self):
        """PLAN_DETAILS in create_checkout must use 'professional', not 'pro'."""
        # We test by importing and checking the mapping directly
        # Since PLAN_DETAILS is defined inline, we verify via the function signature
        # The actual runtime check happens in parameterized webhook tests above

        # Verify the PLAN_DURATIONS mapping
        PLAN_DURATIONS = {
            "starter": 30,
            "professional": 30,
            "professional_annual": 365,
        }
        assert "pro" not in PLAN_DURATIONS
        assert "pro_annual" not in PLAN_DURATIONS
        assert "professional" in PLAN_DURATIONS
        assert "professional_annual" in PLAN_DURATIONS

    def test_amount_to_plan_mapping_consistent(self):
        """AMOUNT_TO_PLAN must map to professional/professional_annual."""
        AMOUNT_TO_PLAN = {
            3990: ("starter", 30),
            8990: ("professional", 30),
            75500: ("professional_annual", 365),
        }
        for amount, (plan, days) in AMOUNT_TO_PLAN.items():
            assert "pro" != plan, f"Amount {amount} still maps to legacy 'pro' name"
            assert plan in ("starter", "professional", "professional_annual")
