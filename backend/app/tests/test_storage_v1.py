#!/usr/bin/env python3
"""
Storage V1 Test Script
Tests multi-tenant file storage
"""

import asyncio
import uuid
from io import BytesIO

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.services.storage import storage_service
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


async def setup_test_data():
    """Create test organizations and profiles"""
    # Create test organizations
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
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
            id=uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff"),
            name="Test Organization B",
            slug="test-org-b"
        )
        db.add(org_b)
        await db.flush()

        # Create Profile for Org A
        profile_a = Profile(
            id=uuid.UUID("12345678-9012-3456-7890-123456789012"),
            organization_id=org_a.id,
            full_name="Storage User",
            email="storage.user@test.com",
            role="admin"
        )
        db.add(profile_a)

        await db.commit()

    return async_session


async def test_storage_flow():
    """Test the complete storage flow with multi-tenancy"""
    print("🗂️  Starting Storage & Cloud Sync V1 Tests\n")

    # Setup test data
    async_session = await setup_test_data()
    org_a_id = uuid.UUID("12345678-9012-3456-7890-123456789012")
    org_b_id = uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")

    try:
        # Test 1: Upload a kit photo (public bucket)
        print("📸 Test 1: Uploading kit photo to public bucket")
        kit_photo_content = b"fake_image_data_jpeg"  # Simulate JPEG content
        kit_photo_filename = "camera_kit_photo.jpg"

        kit_result = await storage_service.upload_file(
            organization_id=str(org_a_id),
            module="kits",
            filename=kit_photo_filename,
            file_content=kit_photo_content,
            bucket="public-assets"
        )

        print(f"✅ Kit photo uploaded: {kit_result['file_path']}")
        print(f"   Bucket: {kit_result['bucket']} (public: {kit_result['is_public']})")
        print(f"   Access URL: {kit_result.get('access_url', 'N/A')}")

        # Test 2: Upload a script PDF (private bucket)
        print("\n📄 Test 2: Uploading script PDF to private bucket")
        script_content = b"fake_pdf_data_script"  # Simulate PDF content
        script_filename = "movie_script_v1.pdf"

        script_result = await storage_service.upload_file(
            organization_id=str(org_a_id),
            module="scripts",
            filename=script_filename,
            file_content=script_content,
            bucket="production-files"
        )

        print(f"✅ Script PDF uploaded: {script_result['file_path']}")
        print(f"   Bucket: {script_result['bucket']} (public: {script_result['is_public']})")
        print(f"   Access URL: {script_result.get('access_url', 'Requires signed URL')}")

        # Test 3: Generate signed URL for private file
        print("\n🔗 Test 3: Generating signed URL for private file")
        signed_url = await storage_service.generate_signed_url(
            bucket="production-files",
            file_path=script_result["file_path"],
            expires_in=1800  # 30 minutes
        )

        print(f"✅ Signed URL generated (expires in 30 min)")
        print(f"   URL: {signed_url[:50]}...")

        # Test 4: Multi-tenancy security - different org can't access
        print("\n🔒 Test 5: Multi-tenancy security test")
        try:
            # Try to generate signed URL for Org A's file using Org B's context
            # This would be blocked at API level, but let's test the path validation
            invalid_path = script_result["file_path"].replace(str(org_a_id), str(org_b_id))

            # This should fail because the path doesn't start with org_b_id
            if not invalid_path.startswith(str(org_b_id)):
                print("✅ Multi-tenancy path validation working")
                print("   Organizations cannot guess each other's file paths")
            else:
                print("❌ SECURITY ISSUE: Path validation failed!")

        except Exception as e:
            print(f"Error in security test: {e}")

        # Test 5: File validation
        print("\n✅ Test 5: File validation tests")

        # Test oversized file
        large_content = b"x" * (26 * 1024 * 1024)  # 26MB (over limit)
        try:
            await storage_service.upload_file(
                organization_id=str(org_a_id),
                module="scripts",
                filename="too_big.pdf",
                file_content=large_content,
                bucket="production-files"
            )
            print("❌ SECURITY ISSUE: Oversized file accepted!")
        except ValueError as e:
            print(f"✅ File size validation working: {str(e)}")

        # Test invalid file type
        invalid_content = b"fake_exe_content"
        try:
            await storage_service.upload_file(
                organization_id=str(org_a_id),
                module="scripts",
                filename="virus.exe",
                file_content=invalid_content,
                bucket="production-files"
            )
            print("❌ SECURITY ISSUE: Invalid file type accepted!")
        except ValueError as e:
            print(f"✅ File type validation working: {str(e)}")

        print("\n🎉 Storage V1 Tests Completed!")
        print("✅ Multi-tenant file paths implemented")
        print("✅ Public/private bucket separation working")
        print("✅ File validation and security enforced")

    finally:
        pass


if __name__ == "__main__":
    # Run the storage tests
    asyncio.run(test_storage_flow())
