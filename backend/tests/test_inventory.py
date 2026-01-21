"""
Test inventory module functionality.
"""
import pytest
from decimal import Decimal


@pytest.mark.asyncio
async def test_equipment_creation(db_session, sample_equipment_data):
    """Test equipment creation."""
    from app.modules.inventory.services import equipment_service
    from app.modules.inventory.schemas import EquipmentCreate

    # Create equipment
    equipment_data = EquipmentCreate(**sample_equipment_data)
    equipment = await equipment_service.create(db_session, obj_in=equipment_data)

    assert equipment.name == sample_equipment_data["name"]
    assert equipment.category == sample_equipment_data["category"]
    assert equipment.serial_number == sample_equipment_data["serial_number"]
    assert equipment.purchase_price == Decimal(str(sample_equipment_data["purchase_price"]))
    assert equipment.status == sample_equipment_data["status"]


@pytest.mark.asyncio
async def test_equipment_assignment(db_session, sample_equipment_data):
    """Test equipment assignment to user/project."""
    from app.modules.inventory.services import equipment_service
    from app.modules.inventory.schemas import EquipmentCreate, EquipmentAssignmentRequest

    # Create equipment
    equipment_data = EquipmentCreate(**sample_equipment_data)
    equipment = await equipment_service.create(db_session, obj_in=equipment_data)

    # Assign equipment
    assignment_request = EquipmentAssignmentRequest(
        equipment_id=equipment.id,
        assigned_to_user="test-user-id",
        assigned_to_project="Test Project",
        location="Studio A",
        usage_hours=4.5
    )

    assigned_equipment = await equipment_service.assign_equipment(
        db_session,
        request=assignment_request,
        assigned_by="admin-user"
    )

    assert assigned_equipment.status == "in_use"
    assert assigned_equipment.assigned_to_user == "test-user-id"
    assert assigned_equipment.assigned_to_project == "Test Project"
    assert assigned_equipment.current_location == "Studio A"
    assert assigned_equipment.usage_hours == 4.5


@pytest.mark.asyncio
async def test_equipment_return(db_session, sample_equipment_data):
    """Test equipment return."""
    from app.modules.inventory.services import equipment_service
    from app.modules.inventory.schemas import EquipmentCreate, EquipmentAssignmentRequest

    # Create and assign equipment
    equipment_data = EquipmentCreate(**sample_equipment_data)
    equipment = await equipment_service.create(db_session, obj_in=equipment_data)

    assignment_request = EquipmentAssignmentRequest(
        equipment_id=equipment.id,
        assigned_to_user="test-user-id",
        usage_hours=4.5
    )

    await equipment_service.assign_equipment(
        db_session,
        request=assignment_request,
        assigned_by="admin-user"
    )

    # Return equipment
    returned_equipment = await equipment_service.return_equipment(
        db_session,
        equipment_id=equipment.id,
        returned_by="admin-user",
        location="Warehouse",
        usage_hours=2.5
    )

    assert returned_equipment.status == "available"
    assert returned_equipment.assigned_to_user is None
    assert returned_equipment.assigned_to_project is None
    assert returned_equipment.current_location == "Warehouse"
    assert returned_equipment.usage_hours == 7.0  # 4.5 + 2.5


@pytest.mark.asyncio
async def test_maintenance_scheduling(db_session, sample_equipment_data):
    """Test maintenance scheduling."""
    from app.modules.inventory.services import equipment_service, maintenance_service
    from app.modules.inventory.schemas import EquipmentCreate, MaintenanceScheduleRequest
    from datetime import date

    # Create equipment
    equipment_data = EquipmentCreate(**sample_equipment_data)
    equipment = await equipment_service.create(db_session, obj_in=equipment_data)

    # Schedule maintenance
    maintenance_request = MaintenanceScheduleRequest(
        equipment_ids=[equipment.id],
        maintenance_type="inspection",
        scheduled_date=date.today(),
        priority="normal",
        estimated_duration_hours=2.0
    )

    maintenance_logs = await maintenance_service.schedule_maintenance(
        db_session,
        request=maintenance_request,
        scheduled_by="admin-user"
    )

    assert len(maintenance_logs) == 1
    maintenance_log = maintenance_logs[0]

    assert maintenance_log.equipment_id == equipment.id
    assert maintenance_log.maintenance_type == "inspection"
    assert maintenance_log.scheduled_date == date.today()
    assert maintenance_log.priority == "normal"
    assert maintenance_log.estimated_duration_hours == 2.0
    assert maintenance_log.status == "scheduled"


@pytest.mark.asyncio
async def test_inventory_report(db_session, sample_equipment_data):
    """Test inventory reporting."""
    from app.modules.inventory.services import equipment_service
    from app.modules.inventory.schemas import EquipmentCreate

    # Create some equipment
    for i in range(3):
        equipment_data = EquipmentCreate(
            **{**sample_equipment_data, "name": f"Camera {i+1}"}
        )
        await equipment_service.create(db_session, obj_in=equipment_data)

    # Generate report
    report = await equipment_service.generate_inventory_report(db_session)

    assert report["total_equipment"] == 3
    assert report["by_category"]["CAMERA"] == 3
    assert report["by_status"]["available"] == 3
    assert "generated_at" in report