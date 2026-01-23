#!/usr/bin/env python3
"""
Schema Validation Test Script
Tests that all updated schemas can be instantiated and validated correctly.
"""

from datetime import datetime, date, time
from uuid import uuid4
from pydantic import ValidationError

# Test imports
try:
    from app.schemas.projects import ProjectBase, ProjectCreate, ProjectUpdate, Project
    from app.schemas.organizations import OrganizationBase, OrganizationCreate, OrganizationUpdate, Organization
    from app.schemas.clients import ClientBase, ClientCreate, ClientUpdate, Client
    from app.schemas.transactions import TransactionBase, TransactionCreate, TransactionUpdate, Transaction
    from app.schemas.call_sheets import CallSheetBase, CallSheetCreate, CallSheetUpdate, CallSheet
    print("✅ All schema imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    exit(1)


def test_project_schema():
    """Test Project schema with new budget_total_cents field."""
    print("\n🧪 Testing Project Schema...")

    # Test ProjectCreate with budget
    try:
        project_create = ProjectCreate(
            client_id=uuid4(),
            title="Test Project",
            description="Test description",
            status="draft",
            budget_total_cents=100000,  # $1000.00
            start_date=date.today(),
            end_date=date.today()
        )
        print(f"  ✅ ProjectCreate with budget_total_cents: {project_create.budget_total_cents}")
    except Exception as e:
        print(f"  ❌ ProjectCreate failed: {e}")
        return False

    # Test ProjectUpdate with budget
    try:
        project_update = ProjectUpdate(
            budget_total_cents=200000
        )
        print(f"  ✅ ProjectUpdate with budget_total_cents: {project_update.budget_total_cents}")
    except Exception as e:
        print(f"  ❌ ProjectUpdate failed: {e}")
        return False

    # Test Project response with all required fields
    try:
        project = Project(
            client_id=uuid4(),
            title="Test Project",
            status="draft",
            budget_total_cents=100000,
            id=uuid4(),
            organization_id=uuid4(),
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print(f"  ✅ Project response with is_active={project.is_active}, updated_at={project.updated_at}")
    except Exception as e:
        print(f"  ❌ Project response failed: {e}")
        return False

    # Test negative budget (should fail)
    try:
        bad_project = ProjectCreate(
            client_id=uuid4(),
            title="Bad Project",
            budget_total_cents=-100  # Should fail validation
        )
        print(f"  ❌ Negative budget should have failed but didn't!")
        return False
    except ValidationError:
        print(f"  ✅ Negative budget correctly rejected")

    return True


def test_organization_schema():
    """Test Organization schema with plan and subscription_status."""
    print("\n🧪 Testing Organization Schema...")

    # Test OrganizationCreate with plan
    try:
        org_create = OrganizationCreate(
            name="Test Org",
            slug="test-org",
            plan="professional",
            subscription_status="active"
        )
        print(f"  ✅ OrganizationCreate with plan={org_create.plan}, status={org_create.subscription_status}")
    except Exception as e:
        print(f"  ❌ OrganizationCreate failed: {e}")
        return False

    # Test Organization response
    try:
        org = Organization(
            name="Test Org",
            slug="test-org",
            plan="enterprise",
            subscription_status="active",
            id=uuid4(),
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print(f"  ✅ Organization response with is_active={org.is_active}, updated_at={org.updated_at}")
    except Exception as e:
        print(f"  ❌ Organization response failed: {e}")
        return False

    # Test invalid plan (should fail)
    try:
        bad_org = OrganizationCreate(
            name="Bad Org",
            slug="bad-org",
            plan="invalid_plan"  # Should fail
        )
        print(f"  ❌ Invalid plan should have failed but didn't!")
        return False
    except ValidationError:
        print(f"  ✅ Invalid plan correctly rejected")

    return True


def test_client_schema():
    """Test Client schema with document field (not document_id)."""
    print("\n🧪 Testing Client Schema...")

    # Test ClientCreate with document
    try:
        client_create = ClientCreate(
            name="Test Client",
            email="test@example.com",
            document="12345678900",  # FIXED: was document_id
            phone="+55 11 99999-9999"
        )
        print(f"  ✅ ClientCreate with document (not document_id): {client_create.document}")
    except Exception as e:
        print(f"  ❌ ClientCreate failed: {e}")
        return False

    # Test Client response
    try:
        client = Client(
            name="Test Client",
            document="12345678900",
            id=uuid4(),
            organization_id=uuid4(),
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print(f"  ✅ Client response with is_active={client.is_active}, updated_at={client.updated_at}")
    except Exception as e:
        print(f"  ❌ Client response failed: {e}")
        return False

    # Verify document_id attribute doesn't exist
    try:
        hasattr(client_create, 'document_id')
        if hasattr(client_create, 'document_id'):
            print(f"  ⚠️  Warning: document_id attribute still exists (should be removed)")
    except:
        pass

    return True


def test_transaction_schema():
    """Test Transaction schema with supplier_id and category validation."""
    print("\n🧪 Testing Transaction Schema...")

    # Test TransactionCreate with supplier_id
    try:
        transaction_create = TransactionCreate(
            bank_account_id=uuid4(),
            category="crew_hire",
            type="expense",
            amount_cents=50000,
            transaction_date=date.today(),
            project_id=uuid4(),
            supplier_id=uuid4()  # ADDED field
        )
        print(f"  ✅ TransactionCreate with supplier_id: {transaction_create.supplier_id}")
    except Exception as e:
        print(f"  ❌ TransactionCreate failed: {e}")
        return False

    # Test valid categories
    valid_categories = ['crew_hire', 'equipment_rental', 'logistics', 'post_production', 'maintenance', 'other', 'production_revenue']
    for cat in valid_categories:
        try:
            t = TransactionCreate(
                bank_account_id=uuid4(),
                category=cat,
                type="expense",
                amount_cents=1000,
                transaction_date=date.today()
            )
        except ValidationError as e:
            print(f"  ❌ Valid category '{cat}' was rejected: {e}")
            return False
    print(f"  ✅ All valid categories accepted: {', '.join(valid_categories)}")

    # Test invalid category (should fail)
    try:
        bad_transaction = TransactionCreate(
            bank_account_id=uuid4(),
            category="invalid_category",  # Should fail
            type="expense",
            amount_cents=1000,
            transaction_date=date.today()
        )
        print(f"  ❌ Invalid category should have failed but didn't!")
        return False
    except ValidationError as e:
        print(f"  ✅ Invalid category correctly rejected")

    return True


def test_call_sheet_schema():
    """Test CallSheet schema with correct field names."""
    print("\n🧪 Testing CallSheet Schema...")

    # Test CallSheetCreate with correct fields
    try:
        call_sheet_create = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date.today(),  # FIXED: was shooting_date
            location="Studio A",  # FIXED: was location_name
            weather="Sunny",  # FIXED: was weather_forecast
            call_time=time(8, 0),  # ADDED
            status="draft",  # ADDED
            notes="Test notes"
        )
        print(f"  ✅ CallSheetCreate with shooting_day (not shooting_date)")
        print(f"  ✅ CallSheetCreate with location (not location_name)")
        print(f"  ✅ CallSheetCreate with weather (not weather_forecast)")
        print(f"  ✅ CallSheetCreate with call_time: {call_sheet_create.call_time}")
        print(f"  ✅ CallSheetCreate with status: {call_sheet_create.status}")
    except Exception as e:
        print(f"  ❌ CallSheetCreate failed: {e}")
        return False

    # Test CallSheet response
    try:
        call_sheet = CallSheet(
            project_id=uuid4(),
            shooting_day=date.today(),
            location="Studio B",
            weather="Cloudy",
            call_time=time(9, 0),
            status="confirmed",
            id=uuid4(),
            organization_id=uuid4(),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print(f"  ✅ CallSheet response with updated_at: {call_sheet.updated_at}")
    except Exception as e:
        print(f"  ❌ CallSheet response failed: {e}")
        return False

    # Test invalid status (should fail)
    try:
        bad_call_sheet = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date.today(),
            status="invalid_status"  # Should fail
        )
        print(f"  ❌ Invalid status should have failed but didn't!")
        return False
    except ValidationError:
        print(f"  ✅ Invalid status correctly rejected")

    # Verify old fields don't exist
    old_fields = ['shooting_date', 'location_name', 'location_address', 'weather_forecast', 'crew_call', 'on_set', 'lunch_time', 'wrap_time']
    for field in old_fields:
        if hasattr(call_sheet_create, field):
            print(f"  ⚠️  Warning: Old field '{field}' still exists (should be removed)")

    return True


def main():
    """Run all schema tests."""
    print("=" * 60)
    print("SCHEMA VALIDATION TEST SUITE")
    print("=" * 60)

    tests = [
        ("Project", test_project_schema),
        ("Organization", test_organization_schema),
        ("Client", test_client_schema),
        ("Transaction", test_transaction_schema),
        ("CallSheet", test_call_sheet_schema)
    ]

    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"\n❌ {name} test crashed: {e}")
            results[name] = False

    print("\n" + "=" * 60)
    print("TEST RESULTS")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} - {name}")

    print("=" * 60)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("=" * 60)

    if passed == total:
        print("\n🎉 All schema validations passed! Schemas are aligned with V2 models.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the errors above.")
        return 1


if __name__ == "__main__":
    exit(main())
