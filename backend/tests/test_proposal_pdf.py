"""
Tests for Proposal PDF Generation Service

These tests validate the PDF generation functionality including:
- Currency formatting for BRL, USD, EUR
- HTML template rendering
- Service and line item handling
- PDF generation with WeasyPrint
"""

import pytest
from datetime import datetime, date
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch
from app.services.proposal_pdf import ProposalPDFService, proposal_pdf_service


class TestCurrencyFormatting:
    """Test currency formatting for different locales."""
    
    def test_format_brl(self):
        """BRL should format as R$ X.XXX,XX"""
        result = ProposalPDFService._format_currency(150000, "BRL")
        assert result == "R$ 1.500,00"
    
    def test_format_brl_small(self):
        """BRL formatting for smaller amounts"""
        result = ProposalPDFService._format_currency(9900, "BRL")
        assert result == "R$ 99,00"
    
    def test_format_usd(self):
        """USD should format as $ X,XXX.XX"""
        result = ProposalPDFService._format_currency(150000, "USD")
        assert result == "$ 1,500.00"
    
    def test_format_eur(self):
        """EUR should format as € X.XXX,XX"""
        result = ProposalPDFService._format_currency(150000, "EUR")
        assert result == "€ 1.500,00"
    
    def test_format_none_value(self):
        """None should be treated as 0"""
        result = ProposalPDFService._format_currency(None, "BRL")
        assert result == "R$ 0,00"
    
    def test_format_zero(self):
        """Zero cents should format correctly"""
        result = ProposalPDFService._format_currency(0, "BRL")
        assert result == "R$ 0,00"
    
    def test_format_large_amount(self):
        """Large amounts should have proper thousand separators"""
        result = ProposalPDFService._format_currency(1000000000, "BRL")  # 10 million
        assert result == "R$ 10.000.000,00"


class TestMockProposal:
    """Create mock proposal objects for testing."""
    
    @staticmethod
    def create_proposal(
        status="draft",
        currency="BRL",
        total_amount_cents=150000,
        base_amount_cents=None,
        description=None,
        terms_conditions=None,
        valid_until=None,
        start_date=None,
        end_date=None,
        proposal_metadata=None
    ):
        """Create a mock proposal object."""
        mock = Mock()
        mock.id = uuid4()
        mock.organization_id = uuid4()
        mock.title = "Test Proposal"
        mock.status = status
        mock.currency = currency
        mock.total_amount_cents = total_amount_cents
        mock.base_amount_cents = base_amount_cents or total_amount_cents
        mock.description = description
        mock.terms_conditions = terms_conditions
        mock.valid_until = valid_until
        mock.start_date = start_date
        mock.end_date = end_date
        mock.created_at = datetime.now()
        mock.proposal_metadata = proposal_metadata or {}
        return mock
    
    @staticmethod
    def create_organization(name="Test Company", email="test@company.com", phone=None, logo_url=None):
        """Create a mock organization object."""
        mock = Mock()
        mock.id = uuid4()
        mock.name = name
        mock.email = email
        mock.phone = phone
        mock.logo_url = logo_url
        return mock
    
    @staticmethod
    def create_client(name="Client Name", company_name=None, email=None, phone=None):
        """Create a mock client object."""
        mock = Mock()
        mock.id = uuid4()
        mock.name = name
        mock.company_name = company_name
        mock.email = email
        mock.phone = phone
        return mock
    
    @staticmethod
    def create_service(name="Test Service", description=None, value_cents=50000):
        """Create a mock service object with correct field names."""
        mock = Mock()
        mock.id = uuid4()
        mock.name = name
        mock.description = description
        mock.value_cents = value_cents  # Correct field name
        return mock


class TestHTMLRendering:
    """Test HTML template rendering."""
    
    @pytest.fixture
    def pdf_service(self):
        return ProposalPDFService()
    
    @pytest.fixture
    def mock_data(self):
        return {
            "proposal": TestMockProposal.create_proposal(
                description="This is a test proposal",
                total_amount_cents=150000,
                currency="BRL"
            ),
            "organization": TestMockProposal.create_organization(),
            "client": TestMockProposal.create_client(
                name="John Doe",
                company_name="ACME Corp",
                email="john@acme.com"
            ),
            "services": [
                TestMockProposal.create_service(
                    name="Video Production",
                    description="Full video production service",
                    value_cents=100000
                ),
                TestMockProposal.create_service(
                    name="Editing",
                    description="Post-production editing",
                    value_cents=50000
                )
            ]
        }
    
    @pytest.mark.asyncio
    async def test_render_html_basic(self, pdf_service, mock_data):
        """HTML should render without errors."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert html is not None
        assert len(html) > 0
        assert "<!DOCTYPE html>" in html
    
    @pytest.mark.asyncio
    async def test_render_html_contains_proposal_title(self, pdf_service, mock_data):
        """HTML should contain the proposal title."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "Test Proposal" in html
    
    @pytest.mark.asyncio
    async def test_render_html_contains_organization(self, pdf_service, mock_data):
        """HTML should contain organization name."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "Test Company" in html
    
    @pytest.mark.asyncio
    async def test_render_html_contains_client(self, pdf_service, mock_data):
        """HTML should contain client info."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "John Doe" in html
        assert "ACME Corp" in html
    
    @pytest.mark.asyncio
    async def test_render_html_contains_services(self, pdf_service, mock_data):
        """HTML should contain service names."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "Video Production" in html
        assert "Editing" in html
    
    @pytest.mark.asyncio
    async def test_render_html_formats_currency(self, pdf_service, mock_data):
        """HTML should contain formatted currency."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        # Should contain BRL formatted amounts
        assert "R$" in html
    
    @pytest.mark.asyncio
    async def test_render_html_with_line_items(self, pdf_service, mock_data):
        """HTML should handle line_items from proposal_metadata."""
        mock_data["proposal"].proposal_metadata = {
            "line_items": [
                {"description": "Extra Equipment", "value_cents": 25000},
                {"description": "Travel Expenses", "value_cents": 10000}
            ]
        }
        
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "Extra Equipment" in html
        assert "Travel Expenses" in html
    
    @pytest.mark.asyncio
    async def test_render_html_no_services(self, pdf_service, mock_data):
        """HTML should render without services."""
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=[]
        )
        
        # Should not crash
        assert html is not None
        assert "<!DOCTYPE html>" in html
    
    @pytest.mark.asyncio
    async def test_render_html_with_terms(self, pdf_service, mock_data):
        """HTML should include terms and conditions."""
        mock_data["proposal"].terms_conditions = "Payment due in 30 days"
        
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "Payment due in 30 days" in html
    
    @pytest.mark.asyncio
    async def test_render_html_with_dates(self, pdf_service, mock_data):
        """HTML should include project dates."""
        mock_data["proposal"].start_date = date(2024, 3, 1)
        mock_data["proposal"].end_date = date(2024, 3, 31)
        
        html = await pdf_service.render_html(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert "01/03/2024" in html
        assert "31/03/2024" in html


class TestPDFGeneration:
    """Test PDF generation with WeasyPrint."""
    
    @pytest.fixture
    def pdf_service(self):
        return ProposalPDFService()
    
    @pytest.fixture
    def mock_data(self):
        return {
            "proposal": TestMockProposal.create_proposal(
                description="PDF Test Proposal",
                total_amount_cents=250000,
                currency="BRL"
            ),
            "organization": TestMockProposal.create_organization(),
            "client": TestMockProposal.create_client(),
            "services": [
                TestMockProposal.create_service(
                    name="Production Service",
                    value_cents=250000
                )
            ]
        }
    
    @pytest.mark.asyncio
    async def test_generate_pdf_returns_bytes(self, pdf_service, mock_data):
        """PDF generation should return bytes."""
        if not pdf_service._check_weasyprint():
            pytest.skip("WeasyPrint not available")
        
        pdf_bytes = await pdf_service.generate_pdf(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
    
    @pytest.mark.asyncio
    async def test_generate_pdf_is_valid_pdf(self, pdf_service, mock_data):
        """Generated bytes should be a valid PDF (start with %PDF)."""
        if not pdf_service._check_weasyprint():
            pytest.skip("WeasyPrint not available")
        
        pdf_bytes = await pdf_service.generate_pdf(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=mock_data["services"]
        )
        
        # PDF files start with %PDF
        assert pdf_bytes[:4] == b'%PDF'
    
    @pytest.mark.asyncio
    async def test_generate_pdf_with_empty_services(self, pdf_service, mock_data):
        """PDF should generate even without services."""
        if not pdf_service._check_weasyprint():
            pytest.skip("WeasyPrint not available")
        
        pdf_bytes = await pdf_service.generate_pdf(
            proposal=mock_data["proposal"],
            organization=mock_data["organization"],
            client=mock_data["client"],
            services=[]
        )
        
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes[:4] == b'%PDF'


class TestServiceInstance:
    """Test the global service instance."""
    
    def test_global_instance_exists(self):
        """Global proposal_pdf_service should be available."""
        assert proposal_pdf_service is not None
        assert isinstance(proposal_pdf_service, ProposalPDFService)
    
    def test_jinja_env_lazy_initialization(self):
        """Jinja environment should be lazily initialized."""
        service = ProposalPDFService()
        assert service._jinja_env is None
        
        # Access the property to trigger initialization
        env = service.jinja_env
        assert env is not None
        assert service._jinja_env is not None
    
    def test_format_currency_filter_registered(self):
        """format_currency filter should be registered in Jinja."""
        service = ProposalPDFService()
        env = service.jinja_env
        
        assert "format_currency" in env.filters


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
