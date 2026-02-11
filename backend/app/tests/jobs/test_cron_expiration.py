import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from datetime import datetime, timedelta, timezone

from app.cron_check_plans import check_expiring_plans
from app.models.organizations import Organization
from app.models.user import Profile, User

@pytest.mark.asyncio
async def test_cron_expiration_warning_5_days(db_session):
    # 1. Setup Data
    # User & Profile
    user = User(email="warning@test.com", hashed_password="pw")
    db_session.add(user)
    await db_session.commit()
    
    profile = Profile(user_id=user.id, first_name="Test", last_name="User")
    db_session.add(profile)
    await db_session.commit()
    
    # Org expiring in 5 days
    now = datetime.now(timezone.utc)
    expiry_date = now + timedelta(days=5, hours=1) # A bit over 5 days to match logic
    
    org = Organization(
        name="Warning Org", 
        slug="warning-org", 
        owner_profile_id=profile.id,
        billing_contact_user_id=profile.id,
        plan="pro",
        plan_id=user.id, # Mock UUID
        billing_status="active",
        access_ends_at=expiry_date
    )
    db_session.add(org)
    await db_session.commit()
    
    # 2. Mock Email Service
    with patch("app.cron_check_plans.send_plan_expiry_warning") as mock_email:
        await check_expiring_plans()
        
        # 3. Verify
        # Logic matches exactly N days diff. 
        # Note: The logic in cron uses (access_ends_at - now).days 
        # If diff is exactly 5.
        mock_email.assert_called()
        args = mock_email.call_args[0]
        assert args[0] == "warning@test.com"
        assert args[2] == 5 # days left argument

@pytest.mark.asyncio
async def test_cron_expired_notice(db_session):
    # 1. Setup Data
    user = User(email="expired@test.com", hashed_password="pw")
    db_session.add(user)
    await db_session.commit()
    
    profile = Profile(user_id=user.id, first_name="Ex", last_name="Pired")
    db_session.add(profile)
    await db_session.commit()
    
    # Org expired yesterday (-1 day)
    now = datetime.now(timezone.utc)
    expiry_date = now - timedelta(days=1, hours=1)
    
    org = Organization(
        name="Expired Org", 
        slug="expired-org", 
        owner_profile_id=profile.id,
        billing_contact_user_id=profile.id,
        plan="pro",
        plan_id=user.id,
        billing_status="active",
        access_ends_at=expiry_date
    )
    db_session.add(org)
    await db_session.commit()
    
    # 2. Mock Email Service
    with patch("app.cron_check_plans.send_plan_expired_notice") as mock_email:
        await check_expiring_plans()
        
        # 3. Verify
        mock_email.assert_called()
        args = mock_email.call_args[0]
        assert args[0] == "expired@test.com"
