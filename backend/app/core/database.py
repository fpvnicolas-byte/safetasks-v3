from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import logging

from .config import settings
from .base import Base

# Configure logging
logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=False,  # Set to False in production to reduce log noise
    pool_pre_ping=True,  # Enable connection health checks
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """
    Dependency to get database session.
    Yields an async database session and ensures it's closed after use.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    """
    Create all database tables defined in SQLAlchemy models.
    This function should be called during application startup.
    """
    try:
        async with engine.begin() as conn:
            # Import all models to ensure they are registered with Base
            from app.core.models import User, Organization
            from app.modules.commercial.models import Client, Budget, Proposal
            from app.modules.production.models import Script, Scene, BreakdownItem
            from app.modules.scheduling.models import ShootingDay, Event, CallSheet
            from app.modules.financial.models import BankAccount, Transaction, Invoice
            from app.modules.inventory.models import Equipment, Kit, KitItem, MaintenanceLog

            # Create all tables
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database tables created successfully")

    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise


async def test_database_connection():
    """
    Test database connection and basic functionality.
    """
    try:
        async with AsyncSessionLocal() as session:
            # Execute a simple query to test connection
            result = await session.execute(text("SELECT 1"))
            await result.fetchone()
        logger.info("Database connection test successful")
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


async def get_database_stats():
    """
    Get basic database statistics.
    """
    try:
        async with AsyncSessionLocal() as session:
            stats = {}

            # Get table counts for each module
            tables_queries = {
                "users": "SELECT COUNT(*) FROM users",
                "organizations": "SELECT COUNT(*) FROM organizations",
                "clients": "SELECT COUNT(*) FROM clients",
                "budgets": "SELECT COUNT(*) FROM budgets",
                "proposals": "SELECT COUNT(*) FROM proposals",
                "scripts": "SELECT COUNT(*) FROM scripts",
                "scenes": "SELECT COUNT(*) FROM scenes",
                "breakdown_items": "SELECT COUNT(*) FROM breakdown_items",
                "shooting_days": "SELECT COUNT(*) FROM shooting_days",
                "events": "SELECT COUNT(*) FROM events",
                "call_sheets": "SELECT COUNT(*) FROM call_sheets",
                "bank_accounts": "SELECT COUNT(*) FROM bank_accounts",
                "transactions": "SELECT COUNT(*) FROM transactions",
                "invoices": "SELECT COUNT(*) FROM invoices",
                "equipment": "SELECT COUNT(*) FROM equipment",
                "kits": "SELECT COUNT(*) FROM kits",
                "maintenance_logs": "SELECT COUNT(*) FROM maintenance_logs"
            }

            for table_name, query in tables_queries.items():
                try:
                    result = await session.execute(text(query))
                    count = result.scalar()
                    stats[table_name] = count or 0
                except Exception:
                    # Table might not exist yet
                    stats[table_name] = 0

        return stats

    except Exception as e:
        logger.error(f"Failed to get database stats: {e}")
        return {}