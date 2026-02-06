"""
Unit tests for Stripe Connect service — no database required.

Tests service functions with mocked dependencies to validate business logic
in isolation. Safe to run without TEST_DATABASE_URI.
"""

import pytest
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.organizations import Organization
from app.models.financial import Invoice, InvoicePaymentMethodEnum
from app.services import stripe_connect as connect_service


# ─── Fixtures ─────────────────────────────────────────────────────────────────

ORG_ID = uuid.UUID("aa000000-0000-0000-0000-000000000001")
INVOICE_ID = uuid.UUID("ff000000-0000-0000-0000-000000000001")
CONNECTED_ACCOUNT_ID = "acct_test_123"
CHECKOUT_SESSION_ID = "cs_test_abc"


def make_org(connected: bool = True):
    """Create a mock Organization object for testing."""
    org = MagicMock(spec=Organization)
    org.id = ORG_ID
    org.name = "Test Org"
    org.slug = "test-org"
    org.stripe_connect_account_id = CONNECTED_ACCOUNT_ID if connected else None
    org.stripe_connect_onboarding_complete = connected
    org.stripe_connect_enabled_at = datetime.now(timezone.utc) if connected else None
    org.default_bank_account_id = uuid.uuid4() if connected else None
    return org


def make_invoice(
    payment_method: str = "stripe",
    status: str = "sent",
    total_cents: int = 100000,
):
    """Create a mock Invoice object for testing."""
    inv = MagicMock(spec=Invoice)
    inv.id = INVOICE_ID
    inv.organization_id = ORG_ID
    inv.client_id = uuid.uuid4()
    inv.project_id = uuid.uuid4()
    inv.invoice_number = "INV-TEST-001"
    inv.status = status
    inv.subtotal_cents = total_cents
    inv.tax_amount_cents = 0
    inv.total_amount_cents = total_cents
    inv.currency = "BRL"
    inv.issue_date = date.today()
    inv.due_date = date.today() + timedelta(days=14)
    inv.description = "Test invoice"
    inv.payment_method = payment_method
    inv.stripe_checkout_session_id = None
    inv.stripe_payment_intent_id = None
    inv.payment_link_url = None
    inv.payment_link_expires_at = None
    inv.paid_at = None
    inv.paid_via = None
    inv.paid_date = None
    return inv


# ─── Test: Onboarding URL ────────────────────────────────────────────────────

def test_onboarding_url_missing_config():
    """Onboarding should fail if STRIPE_CONNECT_CLIENT_ID is not set."""
    org = make_org()
    import asyncio

    with patch.object(connect_service.settings, 'STRIPE_CONNECT_CLIENT_ID', None):
        with pytest.raises(Exception) as exc_info:
            asyncio.get_event_loop().run_until_complete(
                connect_service.create_connect_onboarding_url(org, "https://redirect.example.com")
            )
        assert "not configured" in str(exc_info.value.detail).lower()


def test_onboarding_url_success():
    """Onboarding URL should contain all required OAuth params."""
    org = make_org()
    import asyncio

    with patch.object(connect_service.settings, 'STRIPE_CONNECT_CLIENT_ID', 'ca_test123'):
        url = asyncio.get_event_loop().run_until_complete(
            connect_service.create_connect_onboarding_url(org, "https://redirect.example.com")
        )
        assert "connect.stripe.com/oauth/authorize" in url
        assert "ca_test123" in url
        assert str(ORG_ID) in url
        assert "redirect_uri=https://redirect.example.com" in url


# ─── Test: Connect Status ────────────────────────────────────────────────────

def test_status_not_connected():
    """Disconnected org should return connected=False."""
    org = make_org(connected=False)
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        connect_service.get_connect_status(org)
    )
    assert result["connected"] is False
    assert result["account_id"] is None
    assert result["charges_enabled"] is False


def test_status_connected():
    """Connected org should fetch account details from Stripe."""
    org = make_org(connected=True)
    import asyncio

    mock_account = {
        "charges_enabled": True,
        "payouts_enabled": True,
        "business_profile": {"name": "Acme Corp"},
        "settings": {"dashboard": {"display_name": "Acme"}},
    }

    with patch("app.services.stripe_connect.stripe.Account.retrieve", return_value=mock_account):
        result = asyncio.get_event_loop().run_until_complete(
            connect_service.get_connect_status(org)
        )

    assert result["connected"] is True
    assert result["charges_enabled"] is True
    assert result["business_name"] == "Acme Corp"


# ─── Test: Payment Link Validation ───────────────────────────────────────────

def test_payment_link_rejects_no_connect():
    """Payment link should fail if org has no connected account."""
    org = make_org(connected=False)
    invoice = make_invoice()
    db = AsyncMock()
    import asyncio

    with pytest.raises(Exception) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            connect_service.create_invoice_payment_link(db, org, invoice)
        )
    assert "stripe account" in str(exc_info.value.detail).lower()


def test_payment_link_rejects_wrong_method():
    """Payment link should fail if invoice method is not 'stripe'."""
    org = make_org(connected=True)
    invoice = make_invoice(payment_method="bank_transfer")
    db = AsyncMock()
    import asyncio

    with pytest.raises(Exception) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            connect_service.create_invoice_payment_link(db, org, invoice)
        )
    assert "payment method" in str(exc_info.value.detail).lower()


def test_payment_link_rejects_draft_status():
    """Payment link should fail if invoice is still a draft."""
    org = make_org(connected=True)
    invoice = make_invoice(status="draft")
    db = AsyncMock()
    import asyncio

    with pytest.raises(Exception) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            connect_service.create_invoice_payment_link(db, org, invoice)
        )
    assert "sent" in str(exc_info.value.detail).lower()


def test_payment_link_rejects_zero_amount():
    """Payment link should fail if invoice total is zero."""
    org = make_org(connected=True)
    invoice = make_invoice(total_cents=0)
    db = AsyncMock()
    import asyncio

    with pytest.raises(Exception) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            connect_service.create_invoice_payment_link(db, org, invoice)
        )
    assert "greater than zero" in str(exc_info.value.detail).lower()


def test_payment_link_allows_overdue():
    """Payment link should work for overdue invoices."""
    org = make_org(connected=True)
    invoice = make_invoice(status="overdue")
    db = AsyncMock()
    import asyncio

    mock_session = MagicMock()
    mock_session.id = CHECKOUT_SESSION_ID
    mock_session.url = "https://checkout.stripe.com/pay/test"

    with patch("app.services.stripe_connect.stripe.checkout.Session.create", return_value=mock_session):
        result = asyncio.get_event_loop().run_until_complete(
            connect_service.create_invoice_payment_link(db, org, invoice)
        )

    assert result.stripe_checkout_session_id == CHECKOUT_SESSION_ID
    assert result.payment_link_url == "https://checkout.stripe.com/pay/test"


# ─── Test: Helper Functions ──────────────────────────────────────────────────

def test_determine_paid_via_single_method():
    """Should return stripe_{method} for single payment method type."""
    session = {"payment_method_types": ["card"]}
    assert connect_service._determine_paid_via(session) == "stripe_card"

    session = {"payment_method_types": ["pix"]}
    assert connect_service._determine_paid_via(session) == "stripe_pix"

    session = {"payment_method_types": ["boleto"]}
    assert connect_service._determine_paid_via(session) == "stripe_boleto"


def test_determine_paid_via_multiple_methods():
    """Should return generic 'stripe' for multiple payment methods."""
    session = {"payment_method_types": ["card", "pix", "boleto"]}
    assert connect_service._determine_paid_via(session) == "stripe"


def test_determine_paid_via_empty():
    """Should return generic 'stripe' for empty payment methods."""
    session = {"payment_method_types": []}
    assert connect_service._determine_paid_via(session) == "stripe"


# ─── Test: Event Handler Map ─────────────────────────────────────────────────

def test_event_handler_map_complete():
    """All expected events should have handlers."""
    expected = [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "account.updated",
    ]
    for event in expected:
        assert event in connect_service.CONNECT_EVENT_HANDLERS
        assert callable(connect_service.CONNECT_EVENT_HANDLERS[event])


# ─── Test: InvoicePaymentMethodEnum ──────────────────────────────────────────

def test_payment_method_enum_values():
    """All expected payment method values should exist."""
    assert InvoicePaymentMethodEnum.stripe.value == "stripe"
    assert InvoicePaymentMethodEnum.bank_transfer.value == "bank_transfer"
    assert InvoicePaymentMethodEnum.pix_manual.value == "pix_manual"
    assert InvoicePaymentMethodEnum.boleto_manual.value == "boleto_manual"
    assert InvoicePaymentMethodEnum.cash.value == "cash"
    assert InvoicePaymentMethodEnum.other.value == "other"
