#!/usr/bin/env python3
"""
Shooting Day CRUD Tests
Tests creating, reading, and updating shooting days with new fields from Call Sheet merge.
"""

import asyncio
import uuid
import datetime
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.organizations import Organization
from app.models.projects import Project
from app.models.scheduling import ShootingDay
from app.models.clients import Client
from app.core.base import Base

async def setup_test_data():
    """Create test organization and project"""
    # Use the same database URI as the application
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    
    # Create tables if they don't exist (this uses proper models with new fields)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create Organization
        org = Organization(
            id=uuid.uuid4(),
            name="Test Prod Co - Shooting Day",
            slug=f"test-prod-co-sd-{uuid.uuid4().hex[:8]}"
        )
        db.add(org)
        await db.flush()
        
        # Create Client
        client = Client(
            id=uuid.uuid4(),
            organization_id=org.id,
            name="Test Client",
            email="client@test.com"
        )
        db.add(client)

        # Create Project
        project = Project(
            id=uuid.uuid4(),
            organization_id=org.id,
            client_id=client.id,
            title="Test Movie",
            status="production"
        )
        db.add(project)
        await db.commit()
    
    return async_session, org.id, project.id

async def test_shooting_day_crud():
    print("\n🎬 Test: Shooting Day CRUD with new fields\n")
    
    async_session_factory, org_id, project_id = await setup_test_data()
    
    async with async_session_factory() as db:
        try:
            # 1. Create with new fields
            print("1. Creating Shooting Day with extended fields...")
            shooting_day_id = uuid.uuid4()
            call_time = datetime.time(8, 0)
            on_set = datetime.time(9, 30)
            lunch_time = datetime.time(13, 0)
            
            shooting_day = ShootingDay(
                id=shooting_day_id,
                organization_id=org_id,
                project_id=project_id,
                date=datetime.date(2025, 1, 1),
                status="draft",
                call_time=call_time,
                on_set=on_set,
                lunch_time=lunch_time,
                location_name="Studio 1",
                parking_info="Park at lot B",
                hospital_info="General Hospital, 123 Main St",
                notes="First day of shooting"
            )
            db.add(shooting_day)
            await db.commit()
            
            # 2. Read back
            print("2. Reading back and verifying fields...")
            result = await db.execute(select(ShootingDay).where(ShootingDay.id == shooting_day_id))
            fetched = result.scalar_one()
            
            assert fetched.on_set == on_set, f"Expected on_set {on_set}, got {fetched.on_set}"
            assert fetched.parking_info == "Park at lot B", f"Expected parking logic, got {fetched.parking_info}"
            assert fetched.hospital_info == "General Hospital, 123 Main St", f"Got {fetched.hospital_info}"
            assert fetched.status == "draft"
            print("✅ Create and Read verification passed.")
            
            # 3. Update
            print("3. Updating status and fields...")
            fetched.status = "confirmed"
            fetched.wrap_time = datetime.time(19, 0)
            await db.commit()
            
            result = await db.execute(select(ShootingDay).where(ShootingDay.id == shooting_day_id))
            updated = result.scalar_one()
            
            assert updated.status == "confirmed"
            assert updated.wrap_time == datetime.time(19, 0)
            print("✅ Update verification passed.")
            
        finally:
            # Clean up (optional, but good practice in local dev)
            # await db.delete(updated)
            # await db.delete(project)
            # await db.delete(org)
            # await db.commit()
            await db.close()

if __name__ == "__main__":
    asyncio.run(test_shooting_day_crud())
