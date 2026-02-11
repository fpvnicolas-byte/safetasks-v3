#!/usr/bin/env python3
"""
Commercial Domain V1 Test Script
Direct service testing to validate multi-tenancy
"""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.clients import Client
from app.models.projects import Project
from app.modules.commercial.service import client_service, project_service
from app.schemas.clients import ClientCreate
from app.schemas.projects import ProjectCreate


async def setup_test_data():
    """Create test organizations and profiles"""
    # Create test organizations
    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        echo=False,
        connect_args={
            # Supabase transaction pooler (PgBouncer) safe asyncpg settings.
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        # Create tables if they don't exist
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create Organization A
        org_a = Organization(
            id=uuid.UUID("12345678-9012-3456-7890-123456789012"),
            name="Test Organization A",
            slug="test-org-a"
        )
        db.add(org_a)

        # Create Organization B
        org_b = Organization(
            id=uuid.UUID("98765432-1234-5678-9012-123456789012"),
            name="Test Organization B",
            slug="test-org-b"
        )
        db.add(org_b)
        await db.flush()

        # Create Profile for Org A
        profile_a = Profile(
            id=uuid.UUID("12345678-9012-3456-7890-123456789012"),
            organization_id=org_a.id,
            full_name="User from Org A",
            email="usera@test.com",
            role="admin"
        )
        db.add(profile_a)

        # Create Profile for Org B
        profile_b = Profile(
            id=uuid.UUID("98765432-1234-5678-9012-123456789012"),
            organization_id=org_b.id,
            full_name="User from Org B",
            email="userb@test.com",
            role="admin"
        )
        db.add(profile_b)

        await db.commit()

    return async_session


async def test_commercial_flow():
    """Test the complete commercial flow"""
    print("🚀 Starting Commercial Domain V1 Service Tests\n")

    # Setup test data
    async_session = await setup_test_data()

    async with async_session() as db:
        try:
            # Test 1: Create a Client
            print("📝 Test 1: Creating a Client")
            client_data = ClientCreate(
                name="Test Client Corp",
                email="contact@testclient.com",
                document_id="12345678000123",
                phone="+55 11 99999-9999"
            )

            org_a_id = uuid.UUID("12345678-9012-3456-7890-123456789012")
            client = await client_service.create(
                db=db,
                organization_id=org_a_id,
                obj_in=client_data
            )

            client_id = client.id
            print(f"✅ Client created: {client.name} (ID: {client_id})")

            # Test 2: Create a Project linked to the Client
            print("\n📋 Test 2: Creating a Project linked to the Client")
            project_data = ProjectCreate(
                client_id=client_id,
                title="Test Film Production",
                description="A test film production project",
                status="pre-production",
                start_date="2024-01-15",
                end_date="2024-03-30"
            )

            project = await project_service.create(
                db=db,
                organization_id=org_a_id,
                obj_in=project_data
            )

            project_id = project.id
            print(f"✅ Project created: {project.title} (ID: {project_id})")

            # Test 3: List Projects with client relationships
            print("\n📋 Test 3: Listing Projects with client data")
            from sqlalchemy.orm import selectinload
            from app.models.projects import Project as ProjectModel

            projects = await project_service.get_multi(
                db=db,
                organization_id=org_a_id,
                options=[selectinload(ProjectModel.client)]
            )

            if projects:
                project = projects[0]
                print(f"✅ Projects found: {len(projects)}")
                print(f"   Project title: {project.title}")
                print(f"   Client data present: {project.client is not None}")
                if project.client:
                    print(f"   Client name: {project.client.name}")
                    print(f"   Client email: {project.client.email}")
                else:
                    print("❌ ERROR: Client relationship missing!")
            else:
                print("❌ No projects found")

            # Test 4: Try to access project from different organization (should fail)
            print("\n🔒 Test 4: Cross-organization access test")
            org_b_id = uuid.UUID("98765432-1234-5678-9012-123456789012")

            # This should return None because project belongs to Org A, not Org B
            cross_org_project = await project_service.get(
                db=db,
                organization_id=org_b_id,  # Different organization
                id=project_id
            )

            if cross_org_project is None:
                print("✅ Security working: Cross-organization access blocked")
            else:
                print("❌ SECURITY ISSUE: Cross-organization access allowed!")

            # Test 5: Try to create project with client from different organization
            print("\n🔒 Test 5: Cross-organization client validation test")

            # Create a client in Org B
            client_b_data = ClientCreate(
                name="Client from Org B",
                email="clientb@test.com"
            )

            client_b = await client_service.create(
                db=db,
                organization_id=org_b_id,
                obj_in=client_b_data
            )

            # Try to create project in Org A using client from Org B (should fail in our endpoint)
            project_cross_data = ProjectCreate(
                client_id=client_b.id,  # Client from Org B
                title="Cross-org Project",
                status="draft"
            )

            # This should fail because client belongs to different org
            # Let's test the validation logic directly
            client_check = await client_service.get(
                db=db,
                organization_id=org_a_id,  # Checking in Org A
                id=client_b.id  # Client from Org B
            )

            if client_check is None:
                print("✅ Client validation working: Cannot use client from different organization")
            else:
                print("❌ SECURITY ISSUE: Client validation failed!")

            print("\n🎉 Commercial Domain V1 Service Tests Completed!")

        finally:
            await db.close()


if __name__ == "__main__":
    # Run the service tests
    asyncio.run(test_commercial_flow())
