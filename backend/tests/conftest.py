import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import get_db
from app.core.base import Base


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Clean up
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    connection = await test_engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)

    yield session

    # Rollback transaction and close session
    await transaction.rollback()
    await session.close()
    await connection.close()


@pytest.fixture
async def client():
    """Create test FastAPI client."""
    from fastapi.testclient import TestClient
    from app.main import app

    # Override database dependency for testing
    async def override_get_db():
        # This would return the test session
        # For now, we'll skip full integration tests
        pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_equipment_data():
    """Sample equipment data for testing."""
    return {
        "name": "Canon EOS R5",
        "category": "CAMERA",
        "subcategory": "MIRRORLESS",
        "serial_number": "CN123456789",
        "purchase_price": 3500.00,
        "vendor_name": "Canon Store",
        "status": "available"
    }


@pytest.fixture
def sample_client_data():
    """Sample client data for testing."""
    return {
        "name": "ABC Productions",
        "email": "contact@abcproductions.com",
        "tax_id": "12345678000123",
        "payment_terms_days": 30,
        "credit_limit": 50000.00
    }


@pytest.fixture
def sample_budget_data():
    """Sample budget data for testing."""
    return {
        "name": "Commercial Project Budget",
        "client_id": 1,
        "subtotal": 10000.00,
        "tax_rate_percent": 18.0,
        "line_items": [
            {
                "category": "PRODUCTION",
                "description": "Camera rental",
                "quantity": 5,
                "unit_price": 2000.00,
                "amount": 10000.00
            }
        ]
    }