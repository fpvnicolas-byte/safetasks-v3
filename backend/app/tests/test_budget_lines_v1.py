"""Tests for line-item budgeting feature."""
import pytest


class TestBudgetCategoryEnum:
    """Test BudgetCategory enum."""

    def test_budget_category_enum_exists(self):
        """Test BudgetCategory enum can be imported."""
        from app.models.financial import BudgetCategoryEnum
        assert BudgetCategoryEnum is not None

    def test_budget_category_has_expected_values(self):
        """Test BudgetCategory has standard production categories."""
        from app.models.financial import BudgetCategoryEnum
        assert BudgetCategoryEnum.CREW.value == "crew"
        assert BudgetCategoryEnum.EQUIPMENT.value == "equipment"
        assert BudgetCategoryEnum.LOCATIONS.value == "locations"
        assert BudgetCategoryEnum.POST_PRODUCTION.value == "post_production"


class TestProjectBudgetLineModel:
    """Test ProjectBudgetLine model."""

    def test_project_budget_line_model_exists(self):
        """Test ProjectBudgetLine model can be imported."""
        from app.models.financial import ProjectBudgetLine
        assert ProjectBudgetLine is not None

    def test_project_budget_line_has_required_columns(self):
        """Test ProjectBudgetLine has required columns."""
        from app.models.financial import ProjectBudgetLine
        assert hasattr(ProjectBudgetLine, 'id')
        assert hasattr(ProjectBudgetLine, 'organization_id')
        assert hasattr(ProjectBudgetLine, 'project_id')
        assert hasattr(ProjectBudgetLine, 'category')
        assert hasattr(ProjectBudgetLine, 'description')
        assert hasattr(ProjectBudgetLine, 'estimated_amount_cents')


class TestTransactionBudgetLineLink:
    """Test Transaction has budget_line_id."""

    def test_transaction_has_budget_line_id(self):
        """Test Transaction model has budget_line_id column."""
        from app.models.transactions import Transaction
        assert hasattr(Transaction, 'budget_line_id')
