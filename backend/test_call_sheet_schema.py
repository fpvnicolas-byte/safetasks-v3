#!/usr/bin/env python3
"""
Call Sheet Schema Validation Test - V3 Professional Fields
Tests that all new professional call sheet fields work correctly.
"""

from datetime import datetime, date, time
from uuid import uuid4
from pydantic import ValidationError

try:
    from app.schemas.call_sheets import CallSheetBase, CallSheetCreate, CallSheetUpdate, CallSheet
    print("✅ Call Sheet schema imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    exit(1)


def test_professional_call_sheet():
    """Test Call Sheet with all professional fields."""
    print("\n🧪 Testing Professional Call Sheet Schema...")

    # Test CallSheetCreate with all professional fields
    try:
        call_sheet_create = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date(2026, 2, 15),
            status="confirmed",

            # Location Information
            location="Praia de Copacabana - Posto 6",
            location_address="Av. Atlântica, 3264 - Copacabana, RJ\nhttps://goo.gl/maps/exemplo123",
            parking_info="Estacionamento privado na Rua Santa Clara, 50",

            # Time Schedule
            crew_call=time(6, 0),
            on_set=time(7, 30),
            lunch_time=time(12, 30),
            wrap_time=time(18, 0),

            # Production Information
            weather="Sol com temperaturas entre 28-32°C",
            notes="Filmagem em área pública - autorização anexa",

            # Safety & Logistics
            hospital_info="Hospital Copa Star - (21) 2545-3600"
        )

        print(f"  ✅ CallSheetCreate with all professional fields")
        print(f"     Location: {call_sheet_create.location}")
        print(f"     Crew Call: {call_sheet_create.crew_call}")
        print(f"     On Set: {call_sheet_create.on_set}")
        print(f"     Lunch: {call_sheet_create.lunch_time}")
        print(f"     Wrap: {call_sheet_create.wrap_time}")
        print(f"     Has Address: {call_sheet_create.location_address is not None}")
        print(f"     Has Parking Info: {call_sheet_create.parking_info is not None}")
        print(f"     Has Hospital Info: {call_sheet_create.hospital_info is not None}")

    except Exception as e:
        print(f"  ❌ CallSheetCreate failed: {e}")
        return False

    # Test CallSheetUpdate with partial fields
    try:
        call_sheet_update = CallSheetUpdate(
            crew_call=time(7, 0),  # Update only crew call time
            weather="Forecast updated: Cloudy morning"
        )
        print(f"  ✅ CallSheetUpdate with partial fields works")
    except Exception as e:
        print(f"  ❌ CallSheetUpdate failed: {e}")
        return False

    # Test CallSheet response with all fields
    try:
        call_sheet = CallSheet(
            project_id=uuid4(),
            shooting_day=date(2026, 2, 15),
            status="confirmed",
            location="Studio A",
            location_address="123 Main St, São Paulo",
            parking_info="Free parking in basement",
            crew_call=time(8, 0),
            on_set=time(9, 0),
            lunch_time=time(13, 0),
            wrap_time=time(19, 0),
            weather="Partly cloudy",
            notes="Indoor shoot",
            hospital_info="Hospital São Paulo - 2km",
            id=uuid4(),
            organization_id=uuid4(),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        print(f"  ✅ CallSheet response with all professional fields")
        print(f"     Status: {call_sheet.status}")
        print(f"     Time Range: {call_sheet.crew_call} - {call_sheet.wrap_time}")
    except Exception as e:
        print(f"  ❌ CallSheet response failed: {e}")
        return False

    # Test minimal call sheet (only required fields)
    try:
        minimal_call_sheet = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date(2026, 2, 20)
            # All other fields are optional
        )
        print(f"  ✅ Minimal CallSheet (only required fields) works")
        print(f"     Default status: {minimal_call_sheet.status}")
    except Exception as e:
        print(f"  ❌ Minimal CallSheet failed: {e}")
        return False

    # Test invalid status (should fail)
    try:
        bad_call_sheet = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date(2026, 2, 20),
            status="invalid_status"  # Should fail
        )
        print(f"  ❌ Invalid status should have failed but didn't!")
        return False
    except ValidationError:
        print(f"  ✅ Invalid status correctly rejected")

    return True


def test_field_types():
    """Test that all field types are correctly defined."""
    print("\n🧪 Testing Field Type Definitions...")

    try:
        # Test time fields accept time objects
        cs = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date.today(),
            crew_call=time(8, 30, 45)  # Hours, minutes, seconds
        )
        print(f"  ✅ Time fields accept time objects: {cs.crew_call}")

        # Test text fields accept long strings
        long_address = "A" * 500  # 500 characters
        cs2 = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date.today(),
            location_address=long_address,
            parking_info=long_address,
            hospital_info=long_address,
            notes=long_address
        )
        print(f"  ✅ TEXT fields accept long strings (500+ chars)")

        # Test all fields are optional except project_id and shooting_day
        cs3 = CallSheetCreate(
            project_id=uuid4(),
            shooting_day=date.today()
        )
        assert cs3.location is None
        assert cs3.crew_call is None
        assert cs3.hospital_info is None
        print(f"  ✅ All fields except project_id and shooting_day are optional")

    except Exception as e:
        print(f"  ❌ Field type test failed: {e}")
        return False

    return True


def main():
    """Run all call sheet schema tests."""
    print("=" * 70)
    print("CALL SHEET SCHEMA VALIDATION TEST - V3 PROFESSIONAL FIELDS")
    print("=" * 70)

    tests = [
        ("Professional Call Sheet", test_professional_call_sheet),
        ("Field Types", test_field_types)
    ]

    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"\n❌ {name} test crashed: {e}")
            results[name] = False

    print("\n" + "=" * 70)
    print("TEST RESULTS")
    print("=" * 70)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} - {name}")

    print("=" * 70)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("=" * 70)

    if passed == total:
        print("\n🎉 All call sheet validations passed!")
        print("✅ Professional call sheet fields are fully functional.")
        print("\nNew fields available:")
        print("  📍 Location: location_address, parking_info")
        print("  ⏰ Time: crew_call, on_set, lunch_time, wrap_time")
        print("  🏥 Safety: hospital_info")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the errors above.")
        return 1


if __name__ == "__main__":
    exit(main())
