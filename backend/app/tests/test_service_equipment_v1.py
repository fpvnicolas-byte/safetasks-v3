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
