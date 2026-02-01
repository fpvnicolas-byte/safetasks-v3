"""Tests for stakeholder booking status feature."""
import pytest
from uuid import uuid4
from datetime import date

from app.models.commercial import StakeholderStatusEnum


class TestStakeholderStatusEnum:
    """Test the StakeholderStatusEnum exists with correct values."""

    def test_enum_values_exist(self):
        """Test all expected status values exist."""
        assert StakeholderStatusEnum.REQUESTED.value == "requested"
        assert StakeholderStatusEnum.CONFIRMED.value == "confirmed"
        assert StakeholderStatusEnum.WORKING.value == "working"
        assert StakeholderStatusEnum.COMPLETED.value == "completed"
        assert StakeholderStatusEnum.CANCELLED.value == "cancelled"

    def test_enum_has_five_values(self):
        """Test enum has exactly 5 status values."""
        assert len(StakeholderStatusEnum) == 5


class TestStakeholderModelColumns:
    """Test Stakeholder model has booking status columns."""

    def test_stakeholder_has_status_column(self):
        """Test Stakeholder model has status column."""
        from app.models.commercial import Stakeholder
        assert hasattr(Stakeholder, 'status')

    def test_stakeholder_has_booking_dates(self):
        """Test Stakeholder model has booking date columns."""
        from app.models.commercial import Stakeholder
        assert hasattr(Stakeholder, 'booking_start_date')
        assert hasattr(Stakeholder, 'booking_end_date')

    def test_stakeholder_has_confirmed_rate(self):
        """Test Stakeholder model has confirmed rate columns."""
        from app.models.commercial import Stakeholder
        assert hasattr(Stakeholder, 'confirmed_rate_cents')
        assert hasattr(Stakeholder, 'confirmed_rate_type')

    def test_stakeholder_has_status_metadata(self):
        """Test Stakeholder model has status metadata columns."""
        from app.models.commercial import Stakeholder
        assert hasattr(Stakeholder, 'status_changed_at')
        assert hasattr(Stakeholder, 'status_notes')


from datetime import date
from pydantic import ValidationError


class TestStakeholderSchemas:
    """Test stakeholder schemas have booking status fields."""

    def test_stakeholder_status_update_schema(self):
        """Test StakeholderStatusUpdate schema exists with correct fields."""
        from app.schemas.commercial import StakeholderStatusUpdate, StakeholderStatusEnum

        update = StakeholderStatusUpdate(
            status=StakeholderStatusEnum.CONFIRMED,
            status_notes="Confirmed via phone call",
            booking_start_date=date(2026, 2, 15),
            booking_end_date=date(2026, 2, 20),
            confirmed_rate_cents=50000,
            confirmed_rate_type="daily"
        )

        assert update.status == StakeholderStatusEnum.CONFIRMED
        assert update.confirmed_rate_cents == 50000

    def test_stakeholder_response_has_status_fields(self):
        """Test Stakeholder response schema includes status fields."""
        from app.schemas.commercial import Stakeholder

        # Check the schema has the fields (by checking model_fields)
        fields = Stakeholder.model_fields
        assert 'status' in fields
        assert 'status_changed_at' in fields
        assert 'booking_start_date' in fields
