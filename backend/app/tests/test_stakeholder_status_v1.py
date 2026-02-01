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
