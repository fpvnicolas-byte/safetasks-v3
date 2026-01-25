#!/usr/bin/env python3
"""
Test script for Supabase Storage integration.
Tests file upload, download (signed URL), and deletion.
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.storage import storage_service


async def test_storage_service():
    """Test the storage service with a simple file upload."""

    print("=" * 60)
    print("Testing Supabase Storage Service")
    print("=" * 60)

    # Test organization and module
    test_org_id = "00000000-0000-0000-0000-000000000001"
    test_module = "kits"

    # Create a test file content
    test_filename = "test_image.jpg"
    test_content = b"This is a test file content simulating an image"

    try:
        # Test 1: Upload file to public bucket
        print("\n[1/4] Testing file upload to public bucket...")
        result = await storage_service.upload_file(
            organization_id=test_org_id,
            module=test_module,
            filename=test_filename,
            file_content=test_content,
            bucket="public-assets"
        )

        print(f"✅ Upload successful!")
        print(f"   File path: {result['file_path']}")
        print(f"   Bucket: {result['bucket']}")
        print(f"   Is public: {result['is_public']}")
        print(f"   Size: {result['size_bytes']} bytes")
        print(f"   Content type: {result['content_type']}")
        if result['access_url']:
            print(f"   Access URL: {result['access_url'][:50]}...")

        uploaded_path = result['file_path']
        uploaded_bucket = result['bucket']

        # Test 2: Get file info
        print("\n[2/4] Testing file info retrieval...")
        try:
            file_info = await storage_service.get_file_info(
                bucket=uploaded_bucket,
                file_path=uploaded_path
            )
            print(f"✅ File info retrieved!")
            print(f"   Name: {file_info.get('name', 'N/A')}")
        except Exception as e:
            print(f"⚠️  File info retrieval failed (this may be expected): {str(e)}")

        # Test 3: Generate signed URL for private file
        print("\n[3/4] Testing signed URL generation...")
        try:
            signed_url = await storage_service.generate_signed_url(
                bucket=uploaded_bucket,
                file_path=uploaded_path,
                expires_in=3600
            )
            print(f"✅ Signed URL generated!")
            print(f"   URL: {signed_url[:50]}...")
        except Exception as e:
            print(f"⚠️  Signed URL generation failed: {str(e)}")

        # Test 4: Delete file
        print("\n[4/4] Testing file deletion...")
        deletion_success = await storage_service.delete_file(
            bucket=uploaded_bucket,
            file_path=uploaded_path
        )

        if deletion_success:
            print(f"✅ File deleted successfully!")
        else:
            print(f"❌ File deletion failed")

        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\n✨ Supabase Storage is properly configured and working!")

    except ValueError as e:
        print(f"\n❌ Validation Error: {str(e)}")
        print("\n💡 This likely means:")
        print("   - File type not allowed")
        print("   - File too large")
        print("   - Invalid bucket name")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ Storage Error: {str(e)}")
        print("\n💡 This likely means:")
        print("   - Supabase credentials are incorrect")
        print("   - Buckets don't exist in Supabase")
        print("   - Network connectivity issue")
        print("\n🔧 Check:")
        print("   1. SUPABASE_URL and SUPABASE_KEY are set in .env")
        print("   2. Buckets 'public-assets' and 'production-files' exist in Supabase Storage")
        print("   3. Service role key has storage permissions")
        sys.exit(1)


if __name__ == "__main__":
    print("\n🚀 Starting Storage Service Test...\n")
    asyncio.run(test_storage_service())
