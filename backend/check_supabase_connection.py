#!/usr/bin/env python3
"""
Check Supabase connection and list available buckets.
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from supabase import create_client

print("=" * 60)
print("Checking Supabase Connection")
print("=" * 60)

# Check credentials
print("\n[1/3] Checking credentials...")
if settings.SUPABASE_URL:
    print(f"✅ SUPABASE_URL: {settings.SUPABASE_URL}")
else:
    print("❌ SUPABASE_URL not set")
    sys.exit(1)

if settings.SUPABASE_KEY:
    print(f"✅ SUPABASE_KEY: {settings.SUPABASE_KEY[:20]}...")
else:
    print("❌ SUPABASE_KEY not set")
    sys.exit(1)

# Try to connect
print("\n[2/3] Connecting to Supabase...")
try:
    supabase = create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_KEY
    )
    print("✅ Connected to Supabase successfully!")
except Exception as e:
    print(f"❌ Connection failed: {str(e)}")
    sys.exit(1)

# List buckets
print("\n[3/3] Listing storage buckets...")
try:
    buckets = supabase.storage.list_buckets()
    if buckets:
        print(f"✅ Found {len(buckets)} bucket(s):")
        for bucket in buckets:
            # Handle both dict and object attributes
            if hasattr(bucket, 'name'):
                name = bucket.name
                is_public = getattr(bucket, 'public', False)
            else:
                name = bucket.get('name', bucket.get('id'))
                is_public = bucket.get('public', False)
            print(f"   - {name} (public: {is_public})")
    else:
        print("⚠️  No buckets found in Supabase Storage")
        print("\n💡 You need to create buckets in Supabase:")
        print("   1. Go to Supabase Dashboard > Storage")
        print("   2. Create bucket 'public-assets' (public=true)")
        print("   3. Create bucket 'production-files' (public=false)")
except Exception as e:
    print(f"⚠️  Could not list buckets: {str(e)}")
    print("\n💡 This may mean:")
    print("   - Storage API is not enabled")
    print("   - Service role key doesn't have storage permissions")

print("\n" + "=" * 60)
print("✅ SUPABASE CONNECTION TEST COMPLETE")
print("=" * 60)
