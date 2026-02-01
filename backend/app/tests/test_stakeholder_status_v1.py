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
