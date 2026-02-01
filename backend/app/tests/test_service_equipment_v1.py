"""Tests for service-equipment linking feature."""
import pytest


class TestServiceEquipmentModel:
    """Test ServiceEquipment junction model exists."""

    def test_service_equipment_model_exists(self):
        """Test ServiceEquipment model can be imported."""
        from app.models.services import ServiceEquipment
        assert ServiceEquipment is not None

    def test_service_equipment_has_required_columns(self):
        """Test ServiceEquipment has required columns."""
        from app.models.services import ServiceEquipment
        assert hasattr(ServiceEquipment, 'id')
        assert hasattr(ServiceEquipment, 'organization_id')
        assert hasattr(ServiceEquipment, 'service_id')
        assert hasattr(ServiceEquipment, 'kit_id')
        assert hasattr(ServiceEquipment, 'is_primary')

    def test_service_has_equipment_links_relationship(self):
        """Test Service model has equipment_links relationship."""
        from app.models.services import Service
        assert hasattr(Service, 'equipment_links')

    def test_kit_has_service_links_relationship(self):
        """Test Kit model has service_links relationship."""
        from app.models.kits import Kit
        assert hasattr(Kit, 'service_links')


class TestServiceEquipmentSchemas:
    """Test service equipment schemas."""

    def test_service_equipment_create_schema(self):
        """Test ServiceEquipmentCreate schema."""
        from app.schemas.services import ServiceEquipmentCreate
        from uuid import uuid4

        data = ServiceEquipmentCreate(
            kit_id=uuid4(),
            is_primary=True,
            notes="Main camera kit"
        )
        assert data.is_primary == True

    def test_service_with_equipment_schema(self):
        """Test ServiceWithEquipment response schema."""
        from app.schemas.services import ServiceWithEquipment
        assert 'equipment' in ServiceWithEquipment.model_fields
