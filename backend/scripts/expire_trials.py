#!/usr/bin/env python3
"""
Background job to expire trials.

Run this script daily (e.g., via cron) to check for expired trials
and update billing_status from trial_active to trial_ended.

Example cron job (runs at midnight):
0 0 * * * cd /path/to/backend && python scripts/expire_trials.py
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.organizations import Organization

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def expire_trials() -> None:
    """Find and expire trials that have ended."""
    async with SessionLocal() as db:
        now = datetime.utcnow()

        # Find orgs with expired trials
        query = select(Organization).where(
            Organization.billing_status == "trial_active",
            Organization.trial_ends_at <= now
        )
        result = await db.execute(query)
        expired_orgs = result.scalars().all()

        if not expired_orgs:
            logger.info("No expired trials found")
            return

        logger.info(f"Found {len(expired_orgs)} expired trials")

        # Update billing status to trial_ended
        for org in expired_orgs:
            org.billing_status = "trial_ended"
            db.add(org)
            logger.info(
                f"Expired trial for org {org.id} ({org.name}), "
                f"trial ended at {org.trial_ends_at}"
            )

        await db.commit()
        logger.info(f"Successfully expired {len(expired_orgs)} trials")


async def main() -> None:
    """Main entry point."""
    try:
        await expire_trials()
    except Exception as e:
        logger.error(f"Failed to expire trials: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
