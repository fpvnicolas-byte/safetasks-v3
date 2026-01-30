#!/usr/bin/env python3
import asyncio
import sys
from pathlib import Path
import json

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal
from app.services.notifications import notification_service
from sqlalchemy import select
from app.models.profiles import Profile

async def create_i18n_test_notification():
    """Create a test notification using translation keys."""

    async with SessionLocal() as db:
        try:
            # Find first profile
            result = await db.execute(select(Profile).limit(1))
            profile = result.scalars().first()

            if not profile:
                print("❌ No profiles found.")
                return

            print(f"✓ Found user profile: {profile.id}")

            # Create notification with keys
            notification = await notification_service.create_for_user(
                db=db,
                organization_id=profile.organization_id,
                profile_id=profile.id,
                title="test_notification_title",
                message="test_notification_message",
                type="info",
                metadata={"param": "It works! 🚀", "test": True}
            )

            await db.commit()
            print(f"✅ Created i18n test notification: {notification.id}")
            print(f"Title Key: {notification.title}")
            print("Check frontend to see if it translates to 'Test Notification 🧪'")

        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_i18n_test_notification())
