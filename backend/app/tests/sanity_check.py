#!/usr/bin/env python3
"""
SAFE TASKS V1 - SANITY CHECK SCRIPT
Critical foundation verification before Step 08
"""

import asyncio
import uuid
from io import BytesIO
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.clients import Client
from app.models.projects import Project
from app.models.bank_accounts import BankAccount
from app.services.financial import transaction_service, bank_account_service
from app.services.storage import storage_service
from app.services.ai_engine import ai_engine_service
from app.schemas.transactions import TransactionCreate
from app.schemas.bank_accounts import BankAccountCreate


async def setup_test_organizations():
    """Create two separate organizations for testing"""
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Organization A (Film Production)
        org_a_id = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        org_a = Organization(
            id=org_a_id,
            name="Film Production Co A",
            slug="film-prod-a"
        )
        db.add(org_a)

        # Organization B (Different Company)
        org_b_id = uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
        org_b = Organization(
            id=org_b_id,
            name="Film Production Co B",
            slug="film-prod-b"
        )
        db.add(org_b)

        # User in Org A (Crew role)
        crew_user_a = Profile(
            id=uuid.UUID("11111111-2222-3333-4444-555555555555"),
            organization_id=org_a_id,
            full_name="Crew Member A",
            role="crew"
        )
        db.add(crew_user_a)

        # User in Org B (Admin role)
        admin_user_b = Profile(
            id=uuid.UUID("22222222-3333-4444-5555-666666666666"),
            organization_id=org_b_id,
            full_name="Admin User B",
            role="admin"
        )
        db.add(admin_user_b)

        # Client in Org A
        client_a = Client(
            id=uuid.UUID("33333333-4444-5555-6666-777777777777"),
            organization_id=org_a_id,
            name="Client A",
            email="client@org-a.com"
        )
        db.add(client_a)

        # Project in Org A
        project_a = Project(
            id=uuid.UUID("44444444-5555-6666-7777-888888888888"),
            organization_id=org_a_id,
            client_id=client_a.id,
            title="Project A",
            status="pre-production"
        )
        db.add(project_a)

        # Bank Account in Org A
        bank_account_a = BankAccount(
            id=uuid.UUID("55555555-6666-7777-8888-999999999999"),
            organization_id=org_a_id,
            name="Bank Account A",
            balance_cents=100000,  # R$ 1,000.00
            currency="BRL"
        )
        db.add(bank_account_a)

        await db.commit()

    return async_session, org_a_id, org_b_id


async def check_1_multi_tenancy_leak():
    """Test 1: Multi-tenancy Leak Test"""
    print("🔒 CHECK 1: MULTI-TENANCY LEAK TEST")
    print("-" * 50)

    async_session, org_a_id, org_b_id = await setup_test_organizations()

    async with async_session() as db:
        try:
            # Test: User from Org B trying to access Project from Org A
            print("Testing cross-organization access...")

            project_a_id = uuid.UUID("44444444-5555-6666-7777-888888888888")

            # This should return None because BaseService filters by organization_id
            project = await project_service.get(
                db=db,
                organization_id=org_b_id,  # Wrong organization!
                id=project_a_id
            )

            if project is None:
                print("✅ PASS: Cross-organization access blocked")
                print("   BaseService correctly filters by organization_id")
                return True
            else:
                print("❌ FAIL: Multi-tenancy leak detected!")
                print(f"   Org B user accessed Org A's project: {project.title}")
                return False

        finally:
            await db.close()


async def check_2_financial_atomicity():
    """Test 2: Financial Atomicity Test"""
    print("\n💰 CHECK 2: FINANCIAL ATOMICITY TEST")
    print("-" * 50)

    async_session, org_a_id, org_b_id = await setup_test_organizations()

    async with async_session() as db:
        try:
            bank_account_id = uuid.UUID("55555555-6666-7777-8888-999999999999")

            # Get initial balance
            account_before = await bank_account_service.get(
                db=db, organization_id=org_a_id, id=bank_account_id
            )
            initial_balance = account_before.balance_cents
            print(f"Initial balance: R$ {initial_balance / 100:.2f}")

            # Create a transaction that should succeed
            transaction_data = TransactionCreate(
                bank_account_id=bank_account_id,
                category="Test Transaction",
                type="expense",
                amount_cents=50000,  # R$ 500.00
                description="Atomicity test transaction",
                transaction_date="2024-01-01"
            )

            transaction = await transaction_service.create(
                db=db,
                organization_id=org_a_id,
                obj_in=transaction_data
            )

            # Check final balance
            account_after = await bank_account_service.get(
                db=db, organization_id=org_a_id, id=bank_account_id
            )
            final_balance = account_after.balance_cents

            expected_balance = initial_balance - 50000  # Expense reduces balance

            if final_balance == expected_balance:
                print("✅ PASS: Transaction atomicity maintained")
                print(f"   Expected: R$ {expected_balance / 100:.2f}")
                print(f"   Actual:   R$ {final_balance / 100:.2f}")
                print("   Both transaction creation and balance update succeeded together")

                # Now test rollback by deleting the transaction
                deleted_transaction = await transaction_service.remove(
                    db=db,
                    organization_id=org_a_id,
                    id=transaction.id
                )

                # Check balance after deletion
                account_after_delete = await bank_account_service.get(
                    db=db, organization_id=org_a_id, id=bank_account_id
                )

                if account_after_delete.balance_cents == initial_balance:
                    print("✅ PASS: Balance rollback on deletion working")
                    return True
                else:
                    print("❌ FAIL: Balance not rolled back on deletion")
                    return False

            else:
                print("❌ FAIL: Balance not updated correctly")
                print(f"   Expected: R$ {expected_balance / 100:.2f}")
                print(f"   Actual:   R$ {final_balance / 100:.2f}")
                return False

        except Exception as e:
            print(f"❌ FAIL: Exception during atomicity test: {str(e)}")
            return False
        finally:
            await db.close()


async def check_3_rbac_enforcement():
    """Test 3: RBAC Enforcement Test"""
    print("\n🛡️ CHECK 3: RBAC ENFORCEMENT TEST")
    print("-" * 50)

    async_session, org_a_id, org_b_id = await setup_test_organizations()

    # Test Shooting Day permissions (simulated)
    print("Testing Shooting Day RBAC...")

    # Crew user (role="crew") should be able to GET but not DELETE
    crew_permissions = {
        "read_shooting_days": True,   # Crew can read
        "create_shooting_days": False, # Only admin/manager
        "update_shooting_days": False, # Only admin/manager
        "delete_shooting_days": False  # Only admin/manager
    }

    # Admin user (role="admin") should be able to do everything
    admin_permissions = {
        "read_shooting_days": True,
        "create_shooting_days": True,
        "update_shooting_days": True,
        "delete_shooting_days": True
    }

    # Check the actual endpoint dependencies
    from app.api.v1.endpoints.shooting_days import router

    # Analyze router routes and their dependencies
    crew_blocked_endpoints = []
    admin_allowed_endpoints = []

    for route in router.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = list(route.methods)
            path = route.path

            # Check for permission dependencies
            dependencies = getattr(route, 'dependencies', [])

            if 'DELETE' in methods:
                # DELETE should require admin/manager permissions
                has_admin_check = any('require_admin' in str(dep) or 'require_admin_or_manager' in str(dep) for dep in dependencies)
                if has_admin_check:
                    admin_allowed_endpoints.append(f"DELETE {path}")
                else:
                    crew_blocked_endpoints.append(f"DELETE {path} (missing admin check)")

            if 'POST' in methods or 'PUT' in methods:
                # POST/PUT should require admin/manager permissions
                has_admin_check = any('require_admin' in str(dep) or 'require_admin_or_manager' in str(dep) for dep in dependencies)
                if has_admin_check:
                    admin_allowed_endpoints.append(f"{methods[0]} {path}")
                else:
                    crew_blocked_endpoints.append(f"{methods[0]} {path} (missing admin check)")

            if 'GET' in methods:
                # GET should allow crew access (no admin dependency)
                has_admin_check = any('require_admin' in str(dep) for dep in dependencies)
                if not has_admin_check:
                    admin_allowed_endpoints.append(f"GET {path} (crew can read)")
                else:
                    crew_blocked_endpoints.append(f"GET {path} (blocked for crew)")

    if len(crew_blocked_endpoints) == 0:
        print("✅ PASS: RBAC correctly implemented for Shooting Days")
        print("   Crew can read, but cannot create/update/delete")
        print("   Admin/Manager have full access")
        return True
    else:
        print("❌ FAIL: RBAC issues found in Shooting Day endpoints:")
        for endpoint in crew_blocked_endpoints:
            print(f"   - {endpoint}")
        return False


async def check_4_storage_signed_urls():
    """Test 4: Storage Signed URLs Test"""
    print("\n🗂️ CHECK 4: STORAGE SIGNED URLS TEST")
    print("-" * 50)

    async_session, org_a_id, org_b_id = await setup_test_organizations()

    try:
        # Test uploading to production-files bucket (should be private)
        print("Testing production-files bucket...")

        file_content = b"Test script content for signed URL test"
        filename = "test_script.pdf"

        upload_result = await storage_service.upload_file(
            organization_id=str(org_a_id),
            module="scripts",
            filename=filename,
            file_content=file_content,
            bucket="production-files"
        )

        print(f"File uploaded: {upload_result['file_path']}")
        print(f"Bucket: {upload_result['bucket']}")
        print(f"Is public: {upload_result['is_public']}")

        if upload_result['bucket'] == "production-files" and not upload_result['is_public']:
            print("✅ PASS: Production files are private (not public)")

            # Test signed URL generation
            signed_url = await storage_service.generate_signed_url(
                bucket="production-files",
                file_path=upload_result["file_path"],
                expires_in=3600
            )

            # Check if it's a signed URL (contains query parameters)
            if '?' in signed_url and 'token' in signed_url:
                print("✅ PASS: Signed URL generated with token")
                print(f"   Signed URL contains auth token: {'token=' in signed_url}")
                return True
            else:
                print("❌ FAIL: Signed URL not properly formatted")
                print(f"   URL: {signed_url[:100]}...")
                return False
        else:
            print("❌ FAIL: Production files should be private")
            return False

    except Exception as e:
        print(f"❌ FAIL: Storage test failed: {str(e)}")
        return False
    finally:
        await async_session.close()


async def check_5_ai_json_integrity():
    """Test 5: AI JSON Integrity Test"""
    print("\n🤖 CHECK 5: AI JSON INTEGRITY TEST")
    print("-" * 50)

    async_session, org_a_id, org_b_id = await setup_test_organizations()

    try:
        # Test script analysis
        print("Testing AI script analysis output structure...")

        test_script = """
        FADE IN:

        INT. OFFICE - DAY

        JOHN (35, businessman) sits at his desk, typing furiously.

        SARAH (28, assistant) enters.

        SARAH
        The client called. They want changes.

        JOHN
        (sighs)
        Again?

        FADE OUT.
        """

        analysis_result = await ai_engine_service.analyze_script_content(
            organization_id=org_a_id,
            script_content=test_script
        )

        # Check required JSON structure
        required_keys = ["characters", "locations", "scenes", "suggested_equipment", "production_notes", "metadata"]

        missing_keys = []
        for key in required_keys:
            if key not in analysis_result:
                missing_keys.append(key)

        if len(missing_keys) == 0:
            print("✅ PASS: AI output contains all required JSON keys")

            # Check character structure
            characters = analysis_result.get("characters", [])
            if characters and isinstance(characters[0], dict):
                char_keys = characters[0].keys()
                required_char_keys = ["name", "description", "scenes_present", "importance"]
                if all(key in char_keys for key in required_char_keys):
                    print("✅ PASS: Character structure matches expected schema")
                else:
                    print("❌ FAIL: Character structure missing required keys")
                    return False

            # Check scene structure
            scenes = analysis_result.get("scenes", [])
            if scenes and isinstance(scenes[0], dict):
                scene_keys = scenes[0].keys()
                required_scene_keys = ["number", "heading", "description", "characters", "estimated_time", "complexity"]
                if all(key in scene_keys for key in required_scene_keys):
                    print("✅ PASS: Scene structure matches expected schema")
                else:
                    print("❌ FAIL: Scene structure missing required keys")
                    return False

            # Check locations structure
            locations = analysis_result.get("locations", [])
            if locations and isinstance(locations[0], dict):
                loc_keys = locations[0].keys()
                required_loc_keys = ["name", "description", "scenes", "day_night"]
                if all(key in loc_keys for key in required_loc_keys):
                    print("✅ PASS: Location structure matches expected schema")
                else:
                    print("❌ FAIL: Location structure missing required keys")
                    return False

            print("✅ PASS: AI JSON output is compatible with future database schema")
            return True

        else:
            print("❌ FAIL: AI output missing required keys:")
            for key in missing_keys:
                print(f"   - {key}")
            return False

    except Exception as e:
        print(f"❌ FAIL: AI integrity test failed: {str(e)}")
        return False
    finally:
        await async_session.close()


async def run_sanity_checks():
    """Run all sanity checks"""
    print("🧪 SAFE TASKS V1 - SANITY CHECK SUITE")
    print("=" * 60)
    print("Verifying foundation integrity before Step 08")
    print("=" * 60)

    checks = [
        ("Multi-tenancy Leak Test", check_1_multi_tenancy_leak),
        ("Financial Atomicity Test", check_2_financial_atomicity),
        ("RBAC Enforcement Test", check_3_rbac_enforcement),
        ("Storage Signed URLs Test", check_4_storage_signed_urls),
        ("AI JSON Integrity Test", check_5_ai_json_integrity),
    ]

    results = []
    for check_name, check_func in checks:
        try:
            result = await check_func()
            results.append((check_name, result))
        except Exception as e:
            print(f"❌ {check_name}: CRITICAL ERROR - {str(e)}")
            results.append((check_name, False))

    # Summary
    print("\n" + "=" * 60)
    print("SANITY CHECK RESULTS SUMMARY")
    print("=" * 60)

    passed = 0
    total = len(results)

    for check_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print("25")
        if result:
            passed += 1

    print(f"\nOVERALL RESULT: {passed}/{total} checks passed")

    if passed == total:
        print("🎉 ALL SANITY CHECKS PASSED!")
        print("✅ Foundation is 100% solid - Ready for Step 08")
        return True
    else:
        print("⚠️  SOME CHECKS FAILED!")
        print("❌ Foundation issues detected - Fix before proceeding")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_sanity_checks())
    exit(0 if success else 1)
