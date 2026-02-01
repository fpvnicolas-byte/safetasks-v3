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


class TestBudgetLineSchemas:
    """Test budget line schemas."""

    def test_budget_line_create_schema(self):
        """Test ProjectBudgetLineCreate schema."""
        from app.schemas.financial import ProjectBudgetLineCreate, BudgetCategoryEnum
        from uuid import uuid4

        data = ProjectBudgetLineCreate(
            project_id=uuid4(),
            category=BudgetCategoryEnum.CREW,
            description="Director of Photography",
            estimated_amount_cents=500000
        )
        assert data.estimated_amount_cents == 500000

    def test_budget_summary_schema(self):
        """Test ProjectBudgetSummary schema."""
        from app.schemas.financial import ProjectBudgetSummary
        assert 'total_estimated_cents' in ProjectBudgetSummary.model_fields
        assert 'total_actual_cents' in ProjectBudgetSummary.model_fields
        assert 'by_category' in ProjectBudgetSummary.model_fields
