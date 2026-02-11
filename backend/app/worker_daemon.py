import asyncio
import logging
import sys
import os

# Ensure backend is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.cron_check_plans import check_expiring_plans

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_scheduler():
    logger.info("Worker Daemon Started. Running immediately first...")
    
    while True:
        try:
            await check_expiring_plans()
        except Exception as e:
            logger.error(f"Job failed: {e}")
        
        # Sleep for 24 hours (86400 seconds)
        logger.info("Sleeping for 24 hours...")
        await asyncio.sleep(86400)

if __name__ == "__main__":
    asyncio.run(run_scheduler())
