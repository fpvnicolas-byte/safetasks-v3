import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta, timezone

from app.services.infinity_pay import InfinityPayService
from app.services import billing as billing_service
from app.models.billing import BillingEvent, Plan
from app.models.organizations import Organization

# Mock HTTPX response
class MockResponse:
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code
        self.response = None # For raise_for_status simulation

    def json(self):
        return self.json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP Error {self.status_code}")

@pytest.fixture
def mock_httpx_post():
    with patch("httpx.AsyncClient.post") as mock:
        yield mock

@pytest.fixture
def infinity_pay_service():
    return InfinityPayService()

@pytest.mark.asyncio
async def test_create_checkout_link(infinity_pay_service, mock_httpx_post):
    # Setup
    mock_httpx_post.return_value = MockResponse({
        "checkout_url": "https://pay.infinity.com/scan/123",
        "qrcode_url": "https://img",
        "qrcode_base64": "base64"
    })
    
    items = [{"price": 8990, "description": "Pro Plan"}]
    metadata = {"order_nsu": "org_123_456"}
    
    # Execute
    url = await infinity_pay_service.create_checkout_link(items, metadata)
    
    # Verify
    assert url == "https://pay.infinity.com/scan/123"
    mock_httpx_post.assert_called_once()

@pytest.mark.asyncio
async def test_verify_payment_success(infinity_pay_service, mock_httpx_post):
    # Setup
    mock_httpx_post.return_value = MockResponse({
        "paid": True,
        "amount": 8990,
        "transaction_nsu": "trans_123"
    })
    
    # Execute
    is_paid, data = await infinity_pay_service.verify_payment("trans_123", "order_123", "slug_123")
    
    # Verify
    assert is_paid is True
    assert data["amount"] == 8990

@pytest.mark.asyncio
async def test_verify_payment_failed(infinity_pay_service, mock_httpx_post):
    # Setup
    mock_httpx_post.return_value = MockResponse({
        "paid": False
    })
    
    # Execute
    is_paid, data = await infinity_pay_service.verify_payment("trans_123", "order_123", "slug_123")
    
    # Verify
    assert is_paid is False

@pytest.mark.asyncio
async def test_process_webhook_full_flow(mock_httpx_post, db_session):
    # 1. Setup Data
    org = Organization(name="Test Org", slug="test-org")
    plan_pro = Plan(name="pro", is_custom=False)
    db_session.add(org)
    db_session.add(plan_pro)
    await db_session.commit()
    await db_session.refresh(org)
    
    order_nsu = f"{org.id}_123456"
    transaction_nsu = "trans_abc_123"
    invoice_slug = "inv_slug_123"
    
    webhook_payload = {
        "order_nsu": order_nsu,
        "transaction_nsu": transaction_nsu,
        "invoice_slug": invoice_slug,
        "amount": 8990,
        "paid_amount": 8990,
        "plan_name": "pro",
    }
    
    # 2. Mock Verification Call
    mock_httpx_post.return_value = MockResponse({
        "paid": True,
        "amount": 8990,
        "transaction_nsu": transaction_nsu,
        "captured_at": "2023-01-01"
    })
    
    # 3. Process Webhook
    await billing_service.process_infinitypay_webhook(db_session, webhook_payload)
    
    # 4. Assert Org Updated
    await db_session.refresh(org)
    assert org.plan == "pro"
    assert org.billing_status == "active"
    assert org.access_ends_at is not None
    assert org.access_ends_at > datetime.now(timezone.utc)
    
    # 5. Assert Ledger Entry
    result = await db_session.execute(
        "SELECT * FROM billing_events WHERE external_id = :tid", 
        {"tid": transaction_nsu}
    )
    event = result.one_or_none()
    assert event is not None
    assert event.provider == "infinitypay"
    assert event.status == "succeeded"
    assert event.amount_cents == 8990

