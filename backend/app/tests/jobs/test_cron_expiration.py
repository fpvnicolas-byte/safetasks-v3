from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.fixture(autouse=True)
async def _truncate_public_schema():
    """Override app/tests DB autouse fixture for pure unit tests."""
    yield


@pytest.mark.asyncio
async def test_cron_expiration_warning_5_days():
    """Org with 5 days left should trigger warning email."""
    now = datetime.now(timezone.utc)
    org = SimpleNamespace(
        id=uuid4(),
        name="Warning Org",
        plan_id=uuid4(),
        billing_status="active",
        subscription_status="active",
        access_ends_at=now + timedelta(days=5, hours=2),
        billing_contact_user_id=uuid4(),
        owner_profile_id=None,
    )
    profile = SimpleNamespace(email="warning@test.com")

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

    mock_warning.assert_called_once()
    assert mock_warning.call_args[0][0] == "warning@test.com"
    assert mock_warning.call_args[0][2] == 5
    mock_expired.assert_not_called()


@pytest.mark.asyncio
async def test_cron_expired_notice_and_blocks_org():
    """Recently expired org should trigger expired notice and be blocked."""
    now = datetime.now(timezone.utc)
    org = SimpleNamespace(
        id=uuid4(),
        name="Expired Org",
        plan_id=uuid4(),
        billing_status="active",
        subscription_status="active",
        access_ends_at=now - timedelta(hours=12),
        billing_contact_user_id=uuid4(),
        owner_profile_id=None,
    )
    profile = SimpleNamespace(email="expired@test.com")

    with patch("app.cron_check_plans.SessionLocal") as MockSession, \
         patch("app.cron_check_plans.send_plan_expired_notice") as mock_expired, \
         patch("app.cron_check_plans.send_plan_expiry_warning") as mock_warning:
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

    mock_expired.assert_called_once()
    assert mock_expired.call_args[0][0] == "expired@test.com"
    mock_warning.assert_not_called()
    assert org.billing_status == "blocked"
    assert org.subscription_status == "past_due"
    mock_db.add.assert_called()
