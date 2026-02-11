import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone

# Add backend directory to python path
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.services.email_service import send_plan_expiry_warning, send_plan_expired_notice
from app.core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_expiring_plans():
    logger.info("Starting daily plan expiration check...")
    
    async with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        # 1. Warning: 5 days left
        target_date_Start = now + timedelta(days=5)
        target_date_End = target_date_Start + timedelta(hours=24) # Broad window for safer match? 
        # Actually safer to check range: access_ends_at BETWEEN now+5days and now+6days
        # But for simplicity let's query all active paid orgs and check logic in python to be precise
        
        # Fetch active organizations with a plan_id (paid)
        query = select(Organization).where(Organization.plan_id.isnot(None), Organization.billing_status == 'active')
        result = await db.execute(query)
        organizations = result.scalars().all()
        
        for org in organizations:
            if not org.access_ends_at:
                continue
                
            days_left = (org.access_ends_at - now).days
            
            # Fetch Billing Contact
            contact_id = org.billing_contact_user_id or org.owner_profile_id
            if not contact_id:
                logger.warning(f"Org {org.id} has no billing contact. Skipping.")
                continue
                
            query_profile = select(Profile).where(Profile.id == contact_id)
            res_profile = await db.execute(query_profile)
            profile = res_profile.scalar_one_or_none()
            
            if not profile or not profile.email:
                logger.warning(f"Profile {contact_id} not found or has no email.")
                continue

            renew_link = f"{settings.FRONTEND_URL}/settings/billing"
            user_email = profile.email

            # ALERT LOGIC
            if days_left == 5:
                logger.info(f"Sending 5-day warning to {user_email} for org {org.name}")
                send_plan_expiry_warning(user_email, org.name, 5, renew_link)
                
            elif days_left == 1:
                logger.info(f"Sending 1-day warning to {user_email} for org {org.name}")
                send_plan_expiry_warning(user_email, org.name, 1, renew_link)
                
            elif days_left < 0 and days_left > -2: # Expired yesterday/today
                logger.info(f"Sending EXPIRED notice to {user_email} for org {org.name}")
                send_plan_expired_notice(user_email, org.name, renew_link)
                
                # Block access for expired organizations
                if org.billing_status != 'blocked':
                    org.billing_status = 'blocked'
                    org.subscription_status = 'past_due'
                    db.add(org)
                    logger.info(f"Blocked access for expired org {org.id} ({org.name})")

        # Commit any status changes
        await db.commit()

    logger.info("Plan expiration check complete.")

if __name__ == "__main__":
    asyncio.run(check_expiring_plans())
