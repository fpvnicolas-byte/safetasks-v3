#!/usr/bin/env python3
"""
Stripe Connect V1 Test Script

Tests the Stripe Connect integration for invoice payments:
1. Model field validation (Organization + Invoice Stripe Connect fields)
2. Stripe Connect service logic (with mocked Stripe API)
3. Payment link creation flow
4. Webhook event processing (checkout.session.completed)
5. Idempotency of webhook processing
6. Edge cases (expired links, disconnected accounts, etc.)
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.bank_accounts import BankAccount
from app.models.clients import Client
from app.models.projects import Project
from app.models.financial import Invoice, InvoiceItem, InvoicePaymentMethodEnum
from app.models.transactions import Transaction
from app.models.billing import BillingEvent
from app.services import stripe_connect as connect_service


# ─── Test Fixtures ────────────────────────────────────────────────────────────

ORG_ID = uuid.UUID("aa000000-0000-0000-0000-000000000001")
PROFILE_ID = uuid.UUID("bb000000-0000-0000-0000-000000000001")
CLIENT_ID = uuid.UUID("cc000000-0000-0000-0000-000000000001")
PROJECT_ID = uuid.UUID("dd000000-0000-0000-0000-000000000001")
BANK_ACCOUNT_ID = uuid.UUID("ee000000-0000-0000-0000-000000000001")
INVOICE_ID = uuid.UUID("ff000000-0000-0000-0000-000000000001")
INVOICE_ID_2 = uuid.UUID("ff000000-0000-0000-0000-000000000002")

CONNECTED_ACCOUNT_ID = "acct_test_connected_123"
CHECKOUT_SESSION_ID = "cs_test_session_abc123"
PAYMENT_INTENT_ID = "pi_test_intent_xyz789"


async def setup_test_data():
    """Create test database fixtures for Stripe Connect tests."""
    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        echo=False,
        connect_args={
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Organization with Stripe Connect
        org = Organization(
            id=ORG_ID,
            name="Test Produtora",
            slug="test-produtora-connect",
            stripe_connect_account_id=CONNECTED_ACCOUNT_ID,
            stripe_connect_onboarding_complete=True,
            stripe_connect_enabled_at=datetime.now(timezone.utc),
        )
        db.add(org)
        await db.flush()

        # Admin profile
        profile = Profile(
            id=PROFILE_ID,
            organization_id=ORG_ID,
            full_name="Admin User",
            email="admin@testprodutora.com",
            role="admin",
        )
        db.add(profile)

        # Bank account
        bank_account = BankAccount(
            id=BANK_ACCOUNT_ID,
            organization_id=ORG_ID,
            name="Main Account",
            balance_cents=0,
            currency="BRL",
        )
        db.add(bank_account)
        await db.flush()

        # Link default account after both rows exist (FK-safe ordering)
        org.default_bank_account_id = BANK_ACCOUNT_ID
        db.add(org)

        # Client
        client = Client(
            id=CLIENT_ID,
            organization_id=ORG_ID,
            name="Client Corp",
            email="client@corp.com",
        )
        db.add(client)
        await db.flush()

        # Project
        project = Project(
            id=PROJECT_ID,
            organization_id=ORG_ID,
            client_id=CLIENT_ID,
            title="Wedding Film",
            status="production",
        )
        db.add(project)
        await db.flush()

        # Invoice 1: Stripe payment, status=sent (ready for payment link)
        invoice_1 = Invoice(
            id=INVOICE_ID,
            organization_id=ORG_ID,
            client_id=CLIENT_ID,
            project_id=PROJECT_ID,
            invoice_number="INV-2026-001",
            status="sent",
            subtotal_cents=500000,
            tax_amount_cents=50000,
            total_amount_cents=550000,
            currency="BRL",
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=14),
            payment_method="stripe",
        )
        db.add(invoice_1)

        # Invoice 2: Manual bank transfer (should NOT get payment link)
        invoice_2 = Invoice(
            id=INVOICE_ID_2,
            organization_id=ORG_ID,
            client_id=CLIENT_ID,
            project_id=PROJECT_ID,
            invoice_number="INV-2026-002",
            status="sent",
            subtotal_cents=300000,
            tax_amount_cents=0,
            total_amount_cents=300000,
            currency="BRL",
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=14),
            payment_method="bank_transfer",
        )
        db.add(invoice_2)

        # Invoice items for invoice 1
        item = InvoiceItem(
            id=uuid.uuid4(),
            organization_id=ORG_ID,
            invoice_id=INVOICE_ID,
            description="Wedding film production",
            quantity=Decimal("1"),
            unit_price_cents=550000,
            total_cents=550000,
        )
        db.add(item)

        await db.commit()

    return async_session


# ─── Test Functions ───────────────────────────────────────────────────────────

async def test_1_model_fields():
    """Test that Stripe Connect fields exist and have correct defaults."""
    print("  TEST 1: Model field validation")

    # Organization fields
    org = Organization(
        id=uuid.uuid4(),
        name="New Org",
        slug="new-org",
    )
    assert org.stripe_connect_account_id is None
    # Legacy rows may default to False; new model instances can be None until onboarding state is set.
    assert org.stripe_connect_onboarding_complete in (None, False)
    assert org.stripe_connect_enabled_at is None
    print("    ✓ Organization Stripe Connect fields: correct defaults")

    # Invoice fields
    inv = Invoice(
        id=uuid.uuid4(),
        organization_id=ORG_ID,
        client_id=CLIENT_ID,
        invoice_number="TEST-001",
        status="draft",
        subtotal_cents=10000,
        tax_amount_cents=0,
        total_amount_cents=10000,
        currency="BRL",
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=14),
    )
    assert inv.stripe_checkout_session_id is None
    assert inv.stripe_payment_intent_id is None
    assert inv.payment_link_url is None
    assert inv.payment_link_expires_at is None
    assert inv.paid_at is None
    assert inv.paid_via is None
    print("    ✓ Invoice Stripe Connect fields: correct defaults")

    # InvoicePaymentMethodEnum
    assert InvoicePaymentMethodEnum.stripe.value == "stripe"
    assert InvoicePaymentMethodEnum.bank_transfer.value == "bank_transfer"
    assert InvoicePaymentMethodEnum.pix_manual.value == "pix_manual"
    assert InvoicePaymentMethodEnum.boleto_manual.value == "boleto_manual"
    assert InvoicePaymentMethodEnum.cash.value == "cash"
    assert InvoicePaymentMethodEnum.other.value == "other"
    print("    ✓ InvoicePaymentMethodEnum: all values correct")

    print("  PASSED ✅\n")


async def test_2_connect_onboarding_url():
    """Test OAuth onboarding URL generation."""
    print("  TEST 2: Connect onboarding URL generation")

    org = Organization(
        id=ORG_ID,
        name="Test Org",
        slug="test-org",
    )

    with patch.object(settings, 'STRIPE_CONNECT_CLIENT_ID', 'ca_test_client_id'):
        url = await connect_service.create_connect_onboarding_url(
            organization=org,
            redirect_uri="https://app.produzo.app/api/v1/stripe-connect/callback",
        )

    assert "connect.stripe.com/oauth/authorize" in url
    assert "ca_test_client_id" in url
    assert str(ORG_ID) in url
    assert "scope=read_write" in url
    print("    ✓ OAuth URL contains all required parameters")

    print("  PASSED ✅\n")


async def test_3_connect_status_not_connected():
    """Test connect status for an org without Stripe Connect."""
    print("  TEST 3: Connect status (not connected)")

    org = Organization(
        id=uuid.uuid4(),
        name="Disconnected Org",
        slug="disconnected-org",
    )

    status_info = await connect_service.get_connect_status(org)

    assert status_info["connected"] == False
    assert status_info["account_id"] is None
    assert status_info["charges_enabled"] == False
    assert status_info["payouts_enabled"] == False
    print("    ✓ Not connected status returned correctly")

    print("  PASSED ✅\n")


async def test_4_connect_status_connected():
    """Test connect status for a connected org (mocked Stripe API)."""
    print("  TEST 4: Connect status (connected)")

    org = Organization(
        id=ORG_ID,
        name="Connected Org",
        slug="connected-org",
        stripe_connect_account_id=CONNECTED_ACCOUNT_ID,
        stripe_connect_onboarding_complete=True,
        stripe_connect_enabled_at=datetime.now(timezone.utc),
    )

    mock_account = {
        "id": CONNECTED_ACCOUNT_ID,
        "charges_enabled": True,
        "payouts_enabled": True,
        "business_profile": {"name": "Client's Business"},
        "settings": {"dashboard": {"display_name": "Client Biz"}},
    }

    with patch("app.services.stripe_connect.stripe.Account.retrieve", return_value=mock_account):
        status_info = await connect_service.get_connect_status(org)

    assert status_info["connected"] == True
    assert status_info["account_id"] == CONNECTED_ACCOUNT_ID
    assert status_info["charges_enabled"] == True
    assert status_info["payouts_enabled"] == True
    assert status_info["business_name"] == "Client's Business"
    print("    ✓ Connected status returned with Stripe account details")

    print("  PASSED ✅\n")


async def test_5_payment_link_creation():
    """Test creating a payment link for a Stripe invoice (mocked Stripe API)."""
    print("  TEST 5: Payment link creation")

    async_session = await setup_test_data()

    mock_session = MagicMock()
    mock_session.id = CHECKOUT_SESSION_ID
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_session_abc123"

    with patch("app.services.stripe_connect.stripe.checkout.Session.create", return_value=mock_session):
        async with async_session() as db:
            # Fetch org and invoice
            org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
            org = org_result.scalar_one()

            inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
            invoice = inv_result.scalar_one()

            updated_invoice = await connect_service.create_invoice_payment_link(
                db=db,
                organization=org,
                invoice=invoice,
            )
            await db.commit()

            assert updated_invoice.stripe_checkout_session_id == CHECKOUT_SESSION_ID
            assert updated_invoice.payment_link_url == "https://checkout.stripe.com/pay/cs_test_session_abc123"
            assert updated_invoice.payment_link_expires_at is not None
            print("    ✓ Payment link created and stored on invoice")

    print("  PASSED ✅\n")


async def test_6_payment_link_wrong_method():
    """Test that payment link creation fails for non-Stripe invoices."""
    print("  TEST 6: Payment link rejected for non-Stripe invoices")

    async_session = await setup_test_data()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID_2))
        invoice = inv_result.scalar_one()

        try:
            await connect_service.create_invoice_payment_link(
                db=db,
                organization=org,
                invoice=invoice,
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "payment method must be set to 'stripe'" in str(e.detail).lower() or "payment method" in str(e.detail).lower()
            print("    ✓ Correctly rejected non-Stripe invoice")

    print("  PASSED ✅\n")


async def test_7_payment_link_draft_invoice():
    """Test that payment link creation fails for draft invoices."""
    print("  TEST 7: Payment link rejected for draft invoices")

    async_session = await setup_test_data()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        # Change to draft
        invoice.status = "draft"
        db.add(invoice)
        await db.flush()

        try:
            await connect_service.create_invoice_payment_link(
                db=db,
                organization=org,
                invoice=invoice,
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "sent" in str(e.detail).lower() or "overdue" in str(e.detail).lower()
            print("    ✓ Correctly rejected draft invoice")

    print("  PASSED ✅\n")


async def test_8_payment_link_no_connect():
    """Test that payment link creation fails when org has no Stripe Connect."""
    print("  TEST 8: Payment link rejected when org not connected")

    async_session = await setup_test_data()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        # Remove connect account
        org.stripe_connect_account_id = None
        db.add(org)
        await db.flush()

        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        try:
            await connect_service.create_invoice_payment_link(
                db=db,
                organization=org,
                invoice=invoice,
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "connect" in str(e.detail).lower() or "stripe account" in str(e.detail).lower()
            print("    ✓ Correctly rejected when org has no Stripe Connect")

    print("  PASSED ✅\n")


async def test_9_webhook_checkout_completed():
    """Test webhook processing for checkout.session.completed (payment complete)."""
    print("  TEST 9: Webhook checkout.session.completed (paid)")

    async_session = await setup_test_data()

    # First, set up the invoice with a checkout session
    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()
        invoice.stripe_checkout_session_id = CHECKOUT_SESSION_ID
        db.add(invoice)
        await db.commit()

    # Process the webhook event
    event_data = {
        "object": {
            "id": CHECKOUT_SESSION_ID,
            "payment_status": "paid",
            "payment_intent": PAYMENT_INTENT_ID,
            "payment_method_types": ["card"],
            "metadata": {
                "invoice_id": str(INVOICE_ID),
                "organization_id": str(ORG_ID),
            },
        }
    }

    async with async_session() as db:
        await connect_service.handle_connect_checkout_completed(db, event_data)
        await db.commit()

    # Verify invoice is marked as paid
    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        assert invoice.status == "paid"
        assert invoice.paid_at is not None
        assert invoice.stripe_payment_intent_id == PAYMENT_INTENT_ID
        assert invoice.paid_via == "stripe_card"
        print("    ✓ Invoice marked as paid with correct payment details")

        # Verify transaction was created
        txn_result = await db.execute(
            select(Transaction).where(
                Transaction.invoice_id == INVOICE_ID,
                Transaction.organization_id == ORG_ID,
            )
        )
        transaction = txn_result.scalar_one_or_none()
        assert transaction is not None
        assert transaction.type == "income"
        assert transaction.amount_cents == 550000
        assert transaction.category == "production_revenue"
        assert transaction.payment_status == "paid"
        print("    ✓ Income transaction created correctly")

        # Verify bank account balance was updated
        acc_result = await db.execute(select(BankAccount).where(BankAccount.id == BANK_ACCOUNT_ID))
        account = acc_result.scalar_one()
        assert account.balance_cents == 550000
        print("    ✓ Bank account balance updated correctly")

    print("  PASSED ✅\n")


async def test_10_webhook_idempotency():
    """Test that processing the same webhook event twice doesn't duplicate records."""
    print("  TEST 10: Webhook idempotency")

    async_session = await setup_test_data()

    # Set up invoice with checkout session
    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()
        invoice.stripe_checkout_session_id = CHECKOUT_SESSION_ID
        db.add(invoice)
        await db.commit()

    event_data = {
        "object": {
            "id": CHECKOUT_SESSION_ID,
            "payment_status": "paid",
            "payment_intent": PAYMENT_INTENT_ID,
            "payment_method_types": ["card"],
            "metadata": {
                "invoice_id": str(INVOICE_ID),
                "organization_id": str(ORG_ID),
            },
        }
    }

    # Process the event twice
    async with async_session() as db:
        await connect_service.handle_connect_checkout_completed(db, event_data)
        await db.commit()

    async with async_session() as db:
        # Second call should be idempotent (invoice already paid)
        await connect_service.handle_connect_checkout_completed(db, event_data)
        await db.commit()

    # Verify only one transaction exists
    async with async_session() as db:
        txn_result = await db.execute(
            select(Transaction).where(
                Transaction.invoice_id == INVOICE_ID,
                Transaction.organization_id == ORG_ID,
            )
        )
        transactions = txn_result.scalars().all()
        assert len(transactions) == 1, f"Expected 1 transaction, got {len(transactions)}"
        print("    ✓ Duplicate webhook processing produced only 1 transaction")

        # Balance should not be double-applied
        acc_result = await db.execute(select(BankAccount).where(BankAccount.id == BANK_ACCOUNT_ID))
        account = acc_result.scalar_one()
        assert account.balance_cents == 550000
        print("    ✓ Bank account balance not double-applied")

    print("  PASSED ✅\n")


async def test_11_webhook_async_payment_succeeded():
    """Test webhook processing for async payment (Boleto/PIX)."""
    print("  TEST 11: Webhook async_payment_succeeded (Boleto)")

    async_session = await setup_test_data()

    # Set up invoice as awaiting payment
    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()
        invoice.stripe_checkout_session_id = CHECKOUT_SESSION_ID
        invoice.status = "sent"  # Still awaiting payment
        db.add(invoice)
        await db.commit()

    event_data = {
        "object": {
            "id": CHECKOUT_SESSION_ID,
            "payment_status": "paid",
            "payment_intent": PAYMENT_INTENT_ID,
            "payment_method_types": ["boleto"],
            "metadata": {
                "invoice_id": str(INVOICE_ID),
                "organization_id": str(ORG_ID),
            },
        }
    }

    async with async_session() as db:
        await connect_service.handle_connect_async_payment_succeeded(db, event_data)
        await db.commit()

    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        assert invoice.status == "paid"
        assert invoice.paid_via == "stripe_boleto"
        assert invoice.paid_at is not None
        print("    ✓ Boleto async payment marked invoice as paid")

        acc_result = await db.execute(select(BankAccount).where(BankAccount.id == BANK_ACCOUNT_ID))
        account = acc_result.scalar_one()
        assert account.balance_cents == 550000
        print("    ✓ Bank account balance updated for async payment")

    print("  PASSED ✅\n")


async def test_12_webhook_checkout_unpaid():
    """Test checkout.session.completed with unpaid status (Boleto generated)."""
    print("  TEST 12: Webhook checkout.session.completed (unpaid — Boleto pending)")

    async_session = await setup_test_data()

    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()
        invoice.stripe_checkout_session_id = CHECKOUT_SESSION_ID
        db.add(invoice)
        await db.commit()

    event_data = {
        "object": {
            "id": CHECKOUT_SESSION_ID,
            "payment_status": "unpaid",
            "payment_method_types": ["boleto"],
            "metadata": {
                "invoice_id": str(INVOICE_ID),
                "organization_id": str(ORG_ID),
            },
        }
    }

    async with async_session() as db:
        await connect_service.handle_connect_checkout_completed(db, event_data)
        await db.commit()

    # Invoice should NOT be marked as paid
    async with async_session() as db:
        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        assert invoice.status == "sent", f"Expected 'sent', got '{invoice.status}'"
        assert invoice.paid_at is None
        print("    ✓ Unpaid checkout session leaves invoice as 'sent'")

    print("  PASSED ✅\n")


async def test_13_disconnect_account():
    """Test disconnecting a Stripe Connect account."""
    print("  TEST 13: Disconnect Stripe Connect account")

    async_session = await setup_test_data()

    with patch("app.services.stripe_connect.stripe.OAuth.deauthorize", return_value={"stripe_user_id": CONNECTED_ACCOUNT_ID}):
        async with async_session() as db:
            org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
            org = org_result.scalar_one()

            assert org.stripe_connect_account_id == CONNECTED_ACCOUNT_ID

            updated_org = await connect_service.disconnect_connect_account(db, org)
            await db.commit()

            assert updated_org.stripe_connect_account_id is None
            assert updated_org.stripe_connect_onboarding_complete == False
            assert updated_org.stripe_connect_enabled_at is None
            print("    ✓ Stripe Connect account disconnected and fields cleared")

    print("  PASSED ✅\n")


async def test_14_connect_event_handler_map():
    """Test that the event handler map is correctly configured."""
    print("  TEST 14: Event handler map verification")

    expected_events = [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "account.updated",
    ]

    for event_type in expected_events:
        assert event_type in connect_service.CONNECT_EVENT_HANDLERS, \
            f"Missing handler for {event_type}"
        assert callable(connect_service.CONNECT_EVENT_HANDLERS[event_type]), \
            f"Handler for {event_type} is not callable"

    print(f"    ✓ All {len(expected_events)} event handlers registered and callable")

    print("  PASSED ✅\n")


async def test_15_payment_status_check():
    """Test payment status checking with mocked Stripe API."""
    print("  TEST 15: Payment status check")

    async_session = await setup_test_data()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()

        # Test without checkout session (no link yet)
        status_info = await connect_service.get_invoice_payment_status(org, invoice)
        assert status_info["invoice_id"] == str(INVOICE_ID)
        assert status_info["checkout_session_status"] is None
        print("    ✓ Status correct when no checkout session exists")

        # Set checkout session and mock Stripe
        invoice.stripe_checkout_session_id = CHECKOUT_SESSION_ID

        mock_session = {
            "status": "open",
            "payment_status": "unpaid",
        }

        with patch("app.services.stripe_connect.stripe.checkout.Session.retrieve", return_value=mock_session):
            status_info = await connect_service.get_invoice_payment_status(org, invoice)

        assert status_info["checkout_session_status"] == "open"
        assert status_info["payment_status"] == "unpaid"
        print("    ✓ Status correct when checkout session is open")

    print("  PASSED ✅\n")


async def test_16_account_updated_webhook():
    """Test account.updated webhook marks onboarding as complete."""
    print("  TEST 16: account.updated webhook")

    async_session = await setup_test_data()

    # Set onboarding_complete to False for testing
    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()
        org.stripe_connect_onboarding_complete = False
        db.add(org)
        await db.commit()

    event_data = {
        "object": {
            "id": CONNECTED_ACCOUNT_ID,
            "charges_enabled": True,
            "payouts_enabled": True,
        }
    }

    async with async_session() as db:
        await connect_service.handle_connect_account_updated(db, event_data)
        await db.commit()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        assert org.stripe_connect_onboarding_complete == True
        print("    ✓ Onboarding marked as complete when charges_enabled")

    print("  PASSED ✅\n")


async def test_17_zero_amount_invoice():
    """Test that payment link creation fails for zero-amount invoices."""
    print("  TEST 17: Payment link rejected for zero-amount invoices")

    async_session = await setup_test_data()

    async with async_session() as db:
        org_result = await db.execute(select(Organization).where(Organization.id == ORG_ID))
        org = org_result.scalar_one()

        inv_result = await db.execute(select(Invoice).where(Invoice.id == INVOICE_ID))
        invoice = inv_result.scalar_one()
        invoice.total_amount_cents = 0
        db.add(invoice)
        await db.flush()

        try:
            await connect_service.create_invoice_payment_link(
                db=db,
                organization=org,
                invoice=invoice,
            )
            assert False, "Should have raised HTTPException"
        except Exception as e:
            assert "greater than zero" in str(e.detail).lower()
            print("    ✓ Correctly rejected zero-amount invoice")

    print("  PASSED ✅\n")


# ─── Main Runner ──────────────────────────────────────────────────────────────

async def run_all_tests():
    """Run all Stripe Connect tests."""
    print("🔗 Starting Stripe Connect V1 Tests\n")

    tests = [
        ("Model Fields", test_1_model_fields),
        ("Connect Onboarding URL", test_2_connect_onboarding_url),
        ("Connect Status (Not Connected)", test_3_connect_status_not_connected),
        ("Connect Status (Connected)", test_4_connect_status_connected),
        ("Payment Link Creation", test_5_payment_link_creation),
        ("Payment Link Wrong Method", test_6_payment_link_wrong_method),
        ("Payment Link Draft Invoice", test_7_payment_link_draft_invoice),
        ("Payment Link No Connect", test_8_payment_link_no_connect),
        ("Webhook Checkout Completed", test_9_webhook_checkout_completed),
        ("Webhook Idempotency", test_10_webhook_idempotency),
        ("Webhook Async Payment", test_11_webhook_async_payment_succeeded),
        ("Webhook Checkout Unpaid", test_12_webhook_checkout_unpaid),
        ("Disconnect Account", test_13_disconnect_account),
        ("Event Handler Map", test_14_connect_event_handler_map),
        ("Payment Status Check", test_15_payment_status_check),
        ("Account Updated Webhook", test_16_account_updated_webhook),
        ("Zero Amount Invoice", test_17_zero_amount_invoice),
    ]

    passed = 0
    failed = 0
    errors = []

    for name, test_fn in tests:
        try:
            await test_fn()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((name, str(e)))
            print(f"  FAILED ❌ {name}: {e}\n")

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")

    if errors:
        print("\nFailed tests:")
        for name, error in errors:
            print(f"  - {name}: {error}")
    else:
        print("\n🎉 All tests passed!")

    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
