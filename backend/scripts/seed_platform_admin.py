import asyncio
import sys
import os
from typing import Optional

# Add parent dir to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.profiles import Profile
from app.models.platform import PlatformAdminUser

async def _find_profile_by_email(db, email: str) -> Optional[Profile]:
    query = select(Profile).where(Profile.email.ilike(email))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def _create_profile_from_auth_users(db, email: str) -> Optional[Profile]:
    """
    Best-effort fallback:
    If auth.users exists and contains this email, create profile row.
    """
    try:
        result = await db.execute(
            text(
                """
                SELECT id, email, raw_user_meta_data
                FROM auth.users
                WHERE lower(email) = lower(:email)
                LIMIT 1
                """
            ),
            {"email": email},
        )
        row = result.first()
    except Exception:
        # auth.users may not exist in local non-Supabase databases.
        return None

    if not row:
        return None

    user_id = row[0]
    user_email = row[1]
    raw_meta = row[2] or {}
    if not isinstance(raw_meta, dict):
        raw_meta = {}

    profile = Profile(
        id=user_id,
        email=user_email,
        full_name=raw_meta.get("full_name") or raw_meta.get("name"),
        avatar_url=raw_meta.get("avatar_url"),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def seed_admin(email: str):
    print(f"Searching for user with email: {email}")
    async with SessionLocal() as db:
        # 1) Find existing profile
        profile = await _find_profile_by_email(db, email)

        if not profile:
            # 2) Fallback: try to create from auth.users (if available)
            profile = await _create_profile_from_auth_users(db, email)

        if not profile:
            print(f"Error: No profile found for {email}")
            print("Hints:")
            print("- Log in once in the frontend with this email.")
            print("- Ensure backend receives /api/v1/profiles/me for that user.")
            print("- Then run: python scripts/list_users.py")
            print("- Finally rerun: python scripts/seed_platform_admin.py <email>")
            return
            
        print(f"Found Profile: {profile.id} ({profile.full_name})")
        
        # 2. Check if already admin
        admin_q = select(PlatformAdminUser).where(PlatformAdminUser.profile_id == profile.id)
        res = await db.execute(admin_q)
        existing = res.scalar_one_or_none()
        
        if existing:
            if not existing.is_active:
                print("User is already an admin but INACTIVE. Reactivating...")
                existing.is_active = True
                await db.commit()
                print("Reactivated.")
            else:
                print("User is already an ACTIVE Platform Admin.")
            return

        # 3. Insert
        new_admin = PlatformAdminUser(
            profile_id=profile.id,
            role="superadmin",
            is_active=True
        )
        db.add(new_admin)
        await db.commit()
        print(f"Successfully promoted {email} to Platform Admin!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_platform_admin.py <email>")
        # Default to a safe fallback or just exit
        sys.exit(1)
        
    asyncio.run(seed_admin(sys.argv[1]))
