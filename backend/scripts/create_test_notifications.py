#!/usr/bin/env python3
"""
Script to create test notifications for development/testing.
Run with: python backend/scripts/create_test_notifications.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal
from app.services.notifications import notification_service
from sqlalchemy import select, text
from app.models.profiles import Profile


async def create_test_notifications():
    """Create various test notifications for the first user found."""

    async with SessionLocal() as db:
        try:
            # Find first profile in the system
            result = await db.execute(
                select(Profile).limit(1)
            )
            profile = result.scalars().first()

            if not profile:
                print("❌ No profiles found in the database. Please create a user first.")
                return

            print(f"✓ Found user profile: {profile.id}")
            print(f"  Organization: {profile.organization_id}")
            print(f"\nCreating test notifications...")

            # Create different types of test notifications
            notifications_data = [
                {
                    "title": "Welcome to Produzo! 🎬",
                    "message": "Your production management system is ready. Start by creating your first project or uploading a script for AI analysis.",
                    "type": "info"
                },
                {
                    "title": "Script Analysis Complete ✅",
                    "message": "Your script 'Summer Commercial' has been analyzed. Found 3 characters, 5 scenes, and 12 production notes. Check the AI dashboard for details.",
                    "type": "success"
                },
                {
                    "title": "Budget Alert ⚠️",
                    "message": "Project 'Brand Campaign 2024' is approaching 85% of the allocated budget. Current spend: $42,500 of $50,000.",
                    "type": "warning"
                },
                {
                    "title": "Equipment Maintenance Due 🔧",
                    "message": "Camera A (RED Dragon) is due for preventive maintenance. Last service was 90 days ago. Schedule maintenance to avoid production delays.",
                    "type": "warning"
                },
                {
                    "title": "Proposal Approved 🎉",
                    "message": "Congratulations! Your proposal for 'Tech Startup Video' has been approved by the client. Budget: $75,000. Project automatically created.",
                    "type": "success"
                },
                {
                    "title": "Payment Received 💰",
                    "message": "Payment of $25,000 received from client 'Acme Corp' for invoice #INV-2024-001. Project 'Product Launch' milestone 1 completed.",
                    "type": "success"
                },
                {
                    "title": "Call Sheet Ready 📋",
                    "message": "Call sheet for Day 3 of 'Summer Campaign' has been generated and is ready for review. 8 crew members, 2 talents, 3 locations scheduled.",
                    "type": "info"
                },
                {
                    "title": "Upload Failed ❌",
                    "message": "Failed to upload 'raw_footage_scene_05.mp4' to Google Drive. Error: File size exceeds maximum limit. Please compress or split the file.",
                    "type": "error"
                },
                {
                    "title": "Talent Conflict ⚠️",
                    "message": "Scheduling conflict detected: Actor 'John Smith' is assigned to two projects on the same day (June 15). Please resolve the conflict.",
                    "type": "warning"
                },
                {
                    "title": "New Team Member Added 👋",
                    "message": "Sarah Johnson has been added to your organization as a Production Manager. They now have access to all active projects.",
                    "type": "info"
                },
            ]

            created_count = 0
            for notif_data in notifications_data:
                notification = await notification_service.create_for_user(
                    db=db,
                    organization_id=profile.organization_id,
                    profile_id=profile.id,
                    title=notif_data["title"],
                    message=notif_data["message"],
                    type=notif_data["type"],
                    metadata={"test": True, "batch_created": True}
                )
                created_count += 1
                print(f"  ✓ Created: {notif_data['title']} ({notif_data['type']})")

            await db.commit()

            print(f"\n✅ Successfully created {created_count} test notifications!")
            print(f"\n📱 View them at: http://localhost:3000/en/notifications")
            print(f"   Or via API: GET http://localhost:8000/api/v1/notifications/")

        except Exception as e:
            print(f"❌ Error creating test notifications: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    print("🔔 Produzo Notification Test Creator")
    print("=" * 50)
    asyncio.run(create_test_notifications())
