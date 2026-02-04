"""
Proposal PDF Generation Service

This service handles rendering proposals to HTML and generating PDFs
using Jinja2 templates and WeasyPrint.
"""

import logging
from io import BytesIO
from pathlib import Path
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Template directory path
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "proposals"


class ProposalPDFService:
    """Service for generating professional PDF proposals."""

    def __init__(self):
        """Initialize Jinja2 environment with custom filters."""
        self._jinja_env: Optional[Environment] = None
        self._weasyprint_available: Optional[bool] = None

    @property
    def jinja_env(self) -> Environment:
        """Lazy initialization of Jinja2 environment."""
        if self._jinja_env is None:
            self._jinja_env = Environment(
                loader=FileSystemLoader(str(TEMPLATE_DIR)),
                autoescape=select_autoescape(['html', 'xml'])
            )
            # Register custom filters
            self._jinja_env.filters["format_currency"] = self._format_currency
        return self._jinja_env

    def _check_weasyprint(self) -> bool:
        """Check if WeasyPrint is available."""
        if self._weasyprint_available is None:
            try:
                from weasyprint import HTML, CSS
                self._weasyprint_available = True
            except ImportError:
                logger.warning("WeasyPrint not installed. PDF generation will be unavailable.")
                self._weasyprint_available = False
            except Exception as e:
                logger.warning(f"WeasyPrint initialization failed: {e}")
                self._weasyprint_available = False
        return self._weasyprint_available

    @staticmethod
    def _format_currency(cents: Optional[int], currency: str = "BRL") -> str:
        """
        Format cents to localized currency string.
        
        Args:
            cents: Amount in cents (e.g., 150000 = R$ 1.500,00)
            currency: Currency code (BRL, USD, EUR)
            
        Returns:
            Formatted currency string
        """
        if cents is None:
            cents = 0
            
        amount = cents / 100
        
        if currency == "BRL":
            # Brazilian format: R$ 1.500,00
            formatted = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return f"R$ {formatted}"
        elif currency == "USD":
            # US format: $ 1,500.00
            return f"$ {amount:,.2f}"
        elif currency == "EUR":
            # European format: € 1.500,00
            formatted = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return f"€ {formatted}"
        else:
            # Default format
            return f"{currency} {amount:,.2f}"

    def _get_logo_path(self, organization: Any) -> Optional[str]:
        """
        Get organization logo path for PDF embedding.
        
        Args:
            organization: Organization object with optional logo_url
            
        Returns:
            Path to logo file or None
        """
        # Check if organization has a logo_url attribute
        if hasattr(organization, 'logo_url') and organization.logo_url:
            # If it's a local file path, return it
            if organization.logo_url.startswith('/') or organization.logo_url.startswith('file://'):
                return organization.logo_url
            # For remote URLs, we'd need to download them first (future enhancement)
            return organization.logo_url
        
        # Check for default logo in templates
        default_logo = TEMPLATE_DIR / "logo_default.png"
        if default_logo.exists():
            return str(default_logo)
        
        return None

    async def render_html(
        self,
        proposal: Any,
        organization: Any,
        client: Any,
        services: List[Any],
        locale: str = "pt-BR"
    ) -> str:
        """
        Render proposal data to HTML using Jinja2 template.
        
        Args:
            proposal: Proposal model instance
            organization: Organization model instance
            client: Client model instance
            services: List of Service model instances
            locale: Locale for formatting (default: pt-BR)
            
        Returns:
            Rendered HTML string
        """
        template = self.jinja_env.get_template("proposal.html")
        
        # Extract line items from proposal metadata
        metadata = proposal.proposal_metadata or {}
        line_items = metadata.get("line_items", [])
        
        context = {
            "proposal": proposal,
            "organization": organization,
            "client": client,
            "services": services,
            "line_items": line_items,
            "logo_url": self._get_logo_path(organization),
            "generated_at": datetime.utcnow().isoformat(),
            "locale": locale,
        }
        
        rendered = template.render(**context)
        logger.debug(f"Rendered HTML for proposal {proposal.id}")
        
        return rendered

    async def generate_pdf(
        self,
        proposal: Any,
        organization: Any,
        client: Any,
        services: List[Any],
        locale: str = "pt-BR"
    ) -> bytes:
        """
        Generate PDF bytes from proposal data.
        
        Args:
            proposal: Proposal model instance
            organization: Organization model instance
            client: Client model instance
            services: List of Service model instances
            locale: Locale for formatting
            
        Returns:
            PDF file as bytes
            
        Raises:
            RuntimeError: If WeasyPrint is not available
        """
        if not self._check_weasyprint():
            raise RuntimeError(
                "WeasyPrint is not available. Please install it with: pip install weasyprint"
            )
        
        from weasyprint import HTML, CSS
        
        # Render HTML content
        html_content = await self.render_html(
            proposal=proposal,
            organization=organization,
            client=client,
            services=services,
            locale=locale
        )
        
        # Load CSS file
        css_path = TEMPLATE_DIR / "proposal.css"
        stylesheets = []
        if css_path.exists():
            stylesheets.append(CSS(filename=str(css_path)))
        
        # Generate PDF
        html_doc = HTML(string=html_content, base_url=str(TEMPLATE_DIR))
        pdf_bytes = html_doc.write_pdf(stylesheets=stylesheets if stylesheets else None)
        
        logger.info(f"Generated PDF for proposal {proposal.id} ({len(pdf_bytes)} bytes)")
        
        return pdf_bytes

    async def generate_and_store(
        self,
        db: Any,
        proposal: Any,
        organization: Any,
        client: Any,
        services: List[Any],
        locale: str = "pt-BR"
    ) -> Dict[str, Any]:
        """
        Generate PDF and upload to storage, updating proposal metadata.
        
        Args:
            db: Database session
            proposal: Proposal model instance
            organization: Organization model instance
            client: Client model instance
            services: List of Service model instances
            locale: Locale for formatting
            
        Returns:
            Dict with PDF path, bucket, size, and signed URL
        """
        from app.services.storage import storage_service
        
        # Generate PDF
        pdf_bytes = await self.generate_pdf(
            proposal=proposal,
            organization=organization,
            client=client,
            services=services,
            locale=locale
        )
        
        # Create filename with proposal ID
        filename = f"proposal_{proposal.id}.pdf"
        
        # Upload to storage
        upload_result = await storage_service.upload_file(
            organization_id=str(proposal.organization_id),
            module="proposals",
            filename=filename,
            file_content=pdf_bytes,
            bucket="production-files"
        )
        
        # Update proposal metadata with PDF info
        current_metadata = proposal.proposal_metadata or {}
        pdf_version = current_metadata.get("pdf", {}).get("version", 0) + 1
        
        current_metadata["pdf"] = {
            "path": upload_result["file_path"],
            "bucket": upload_result["bucket"],
            "generated_at": datetime.utcnow().isoformat(),
            "size_bytes": upload_result["size_bytes"],
            "version": pdf_version
        }
        
        proposal.proposal_metadata = current_metadata
        
        # Flag the JSONB column as modified so SQLAlchemy detects the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(proposal, "proposal_metadata")
        
        # Generate signed URL for download
        signed_url = await storage_service.generate_signed_url(
            bucket=upload_result["bucket"],
            file_path=upload_result["file_path"],
            expires_in=3600  # 1 hour
        )
        
        logger.info(
            f"Stored PDF for proposal {proposal.id} at {upload_result['file_path']} "
            f"(version {pdf_version})"
        )
        
        return {
            "pdf_path": upload_result["file_path"],
            "bucket": upload_result["bucket"],
            "size_bytes": upload_result["size_bytes"],
            "version": pdf_version,
            "signed_url": signed_url
        }

    async def get_existing_pdf_url(
        self,
        proposal: Any,
        expires_in: int = 3600
    ) -> Optional[str]:
        """
        Get signed URL for existing PDF if available.
        
        Args:
            proposal: Proposal model instance
            expires_in: URL expiration in seconds
            
        Returns:
            Signed URL string or None if no PDF exists
        """
        from app.services.storage import storage_service
        
        metadata = proposal.proposal_metadata or {}
        pdf_info = metadata.get("pdf")
        
        if not pdf_info or not pdf_info.get("path"):
            return None
        
        try:
            signed_url = await storage_service.generate_signed_url(
                bucket=pdf_info["bucket"],
                file_path=pdf_info["path"],
                expires_in=expires_in
            )
            return signed_url
        except Exception as e:
            logger.warning(f"Failed to generate signed URL for proposal {proposal.id}: {e}")
            return None


# Global service instance
proposal_pdf_service = ProposalPDFService()
