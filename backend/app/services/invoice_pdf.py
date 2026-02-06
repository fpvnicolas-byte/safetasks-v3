"""
Invoice PDF Generation Service

This service handles rendering invoices to HTML and generating PDFs
using Jinja2 templates and WeasyPrint.
Based on the proposal PDF generation system.
"""

import logging
import re
from io import BytesIO
from pathlib import Path
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Template directory path
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "invoices"

# i18n translations for invoice PDF
INVOICE_PDF_TRANSLATIONS = {
    "pt-BR": {
        "invoice": "Fatura",
        "invoice_number": "Fatura Nº",
        "issue_date": "Data de Emissão",
        "due_date": "Data de Vencimento",
        "paid_date": "Data de Pagamento",
        "status": "Status",
        "client": "Cliente",
        "project": "Projeto",
        "project_period": "Período do Projeto",
        "start": "Início",
        "end": "Término",
        "description": "Descrição",
        "items": "Itens da Fatura",
        "item": "Item",
        "quantity": "Qtd",
        "unit_price": "Preço Unitário",
        "total": "Total",
        "subtotal": "Subtotal",
        "tax": "Impostos",
        "grand_total": "Total",
        "notes": "Observações",
        "payment_info": "Informações de Pagamento",
        "payment_method": "Método de Pagamento",
        "payment_reference": "Referência",
        "payment_notes": "Observações do Pagamento",
        "terms": "Termos e Condições",
        "generated_at": "Documento gerado em",
        "page": "Página",
        "of": "de",
        "status_draft": "Rascunho",
        "status_sent": "Enviada",
        "status_paid": "Paga",
        "status_overdue": "Em Atraso",
        "status_cancelled": "Cancelada",
        "payment_method_bank_transfer": "Transferência Bancária",
        "payment_method_credit_card": "Cartão de Crédito",
        "payment_method_debit_card": "Cartão de Débito",
        "payment_method_cash": "Dinheiro",
        "payment_method_check": "Cheque",
        "payment_method_paypal": "PayPal",
        "payment_method_pix": "PIX",
        "payment_method_other": "Outros",
    },
    "en": {
        "invoice": "Invoice",
        "invoice_number": "Invoice No.",
        "issue_date": "Issue Date",
        "due_date": "Due Date",
        "paid_date": "Payment Date",
        "status": "Status",
        "client": "Client",
        "project": "Project",
        "project_period": "Project Period",
        "start": "Start",
        "end": "End",
        "description": "Description",
        "items": "Invoice Items",
        "item": "Item",
        "quantity": "Qty",
        "unit_price": "Unit Price",
        "total": "Total",
        "subtotal": "Subtotal",
        "tax": "Tax",
        "grand_total": "Total",
        "notes": "Notes",
        "payment_info": "Payment Information",
        "payment_method": "Payment Method",
        "payment_reference": "Reference",
        "payment_notes": "Payment Notes",
        "terms": "Terms & Conditions",
        "generated_at": "Document generated on",
        "page": "Page",
        "of": "of",
        "status_draft": "Draft",
        "status_sent": "Sent",
        "status_paid": "Paid",
        "status_overdue": "Overdue",
        "status_cancelled": "Cancelled",
        "payment_method_bank_transfer": "Bank Transfer",
        "payment_method_credit_card": "Credit Card",
        "payment_method_debit_card": "Debit Card",
        "payment_method_cash": "Cash",
        "payment_method_check": "Check",
        "payment_method_paypal": "PayPal",
        "payment_method_pix": "PIX",
        "payment_method_other": "Other",
    },
}


class InvoicePDFService:
    """Service for generating professional PDF invoices."""

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

    @staticmethod
    def _get_translations(locale: str = "pt-BR") -> Dict[str, str]:
        """
        Get translations for the given locale.

        Args:
            locale: Locale code (pt-BR, en)

        Returns:
            Dictionary of translation keys to values
        """
        # Normalize locale
        normalized = locale.lower().replace("_", "-")
        if normalized.startswith("pt"):
            return INVOICE_PDF_TRANSLATIONS["pt-BR"]
        elif normalized.startswith("en"):
            return INVOICE_PDF_TRANSLATIONS["en"]
        else:
            # Default to Portuguese (primary user base)
            return INVOICE_PDF_TRANSLATIONS["pt-BR"]

    @staticmethod
    def _translate_status(status: str, locale: str = "pt-BR") -> str:
        """Translate invoice status."""
        translations = InvoicePDFService._get_translations(locale)
        key = f"status_{status}"
        return translations.get(key, status.title())

    @staticmethod
    def _translate_payment_method(method: Optional[str], locale: str = "pt-BR") -> str:
        """Translate payment method."""
        if not method:
            return "-"
        translations = InvoicePDFService._get_translations(locale)
        key = f"payment_method_{method}"
        return translations.get(key, method.replace("_", " ").title())

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
        invoice: Any,
        organization: Any,
        client: Any,
        items: List[Any],
        locale: str = "pt-BR"
    ) -> str:
        """
        Render invoice data to HTML using Jinja2 template.

        Args:
            invoice: Invoice model instance
            organization: Organization model instance
            client: Client model instance
            items: List of InvoiceItem model instances
            locale: Locale for formatting (default: pt-BR)

        Returns:
            Rendered HTML string
        """
        template = self.jinja_env.get_template("invoice.html")

        # Get translations
        translations = self._get_translations(locale)

        context = {
            "invoice": invoice,
            "organization": organization,
            "client": client,
            "items": items,
            "logo_url": self._get_logo_path(organization),
            "generated_at": datetime.utcnow().isoformat(),
            "locale": locale,
            "t": translations,
            "translate_status": lambda s: self._translate_status(s, locale),
            "translate_payment_method": lambda m: self._translate_payment_method(m, locale),
        }

        rendered = template.render(**context)
        logger.debug(f"Rendered HTML for invoice {invoice.id}")

        return rendered

    async def generate_pdf(
        self,
        invoice: Any,
        organization: Any,
        client: Any,
        items: List[Any],
        locale: str = "pt-BR"
    ) -> bytes:
        """
        Generate PDF bytes from invoice data.

        Args:
            invoice: Invoice model instance
            organization: Organization model instance
            client: Client model instance
            items: List of InvoiceItem model instances
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
            invoice=invoice,
            organization=organization,
            client=client,
            items=items,
            locale=locale
        )

        # Load CSS file
        css_path = TEMPLATE_DIR / "invoice.css"
        stylesheets = []
        if css_path.exists():
            stylesheets.append(CSS(filename=str(css_path)))

        # Generate PDF
        html_doc = HTML(string=html_content, base_url=str(TEMPLATE_DIR))
        pdf_bytes = html_doc.write_pdf(stylesheets=stylesheets if stylesheets else None)

        logger.info(f"Generated PDF for invoice {invoice.id} ({len(pdf_bytes)} bytes)")

        return pdf_bytes

    async def generate_and_store(
        self,
        db: Any,
        invoice: Any,
        organization: Any,
        client: Any,
        items: List[Any],
        locale: str = "pt-BR"
    ) -> Dict[str, Any]:
        """
        Generate PDF and upload to storage, updating invoice metadata.

        Args:
            db: Database session
            invoice: Invoice model instance
            organization: Organization model instance
            client: Client model instance
            items: List of InvoiceItem model instances
            locale: Locale for formatting

        Returns:
            Dict with PDF path, bucket, size, and signed URL
        """
        from app.services.storage import storage_service

        # Generate PDF
        pdf_bytes = await self.generate_pdf(
            invoice=invoice,
            organization=organization,
            client=client,
            items=items,
            locale=locale
        )

        # Create friendly filename: Invoice_Client_Number_Date.pdf
        def sanitize_filename(name: str) -> str:
            # Replace spaces with underscores and remove non-alphanumeric chars (except -_)
            name = re.sub(r'\s+', '_', name)
            return re.sub(r'[^\w\-_]', '', name)

        client_name = sanitize_filename(client.name if client else "Cliente")
        invoice_number = sanitize_filename(invoice.invoice_number or "")
        date_str = datetime.now().strftime("%Y-%m-%d")

        filename = f"Invoice_{client_name}_{invoice_number}_{date_str}.pdf"

        # Upload to storage (using invoice ID as entity_id for folder organization)
        upload_result = await storage_service.upload_file(
            organization_id=str(invoice.organization_id),
            module="invoices",
            filename=filename,
            file_content=pdf_bytes,
            bucket="production-files",
            entity_id=str(invoice.id)
        )

        # Update invoice notes with PDF metadata (invoices don't have a metadata JSONB,
        # so we store PDF info in a similar approach - we'll add it to a class-level tracking)
        # Since Invoice model doesn't have a metadata JSONB column like proposals,
        # we return the info and let the endpoint handle storage tracking

        # Generate signed URL for download
        signed_url = await storage_service.generate_signed_url(
            bucket=upload_result["bucket"],
            file_path=upload_result["file_path"],
            expires_in=3600  # 1 hour
        )

        logger.info(
            f"Stored PDF for invoice {invoice.id} at {upload_result['file_path']}"
        )

        return {
            "pdf_path": upload_result["file_path"],
            "bucket": upload_result["bucket"],
            "size_bytes": upload_result["size_bytes"],
            "signed_url": signed_url,
            "filename": filename,
        }

    async def get_existing_pdf_url(
        self,
        organization_id: str,
        invoice_id: str,
        expires_in: int = 3600
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a PDF exists for this invoice in storage and return its signed URL.

        Args:
            organization_id: Organization UUID string
            invoice_id: Invoice UUID string
            expires_in: URL expiration in seconds

        Returns:
            Dict with signed_url and file info, or None if no PDF exists
        """
        from app.services.storage import storage_service

        try:
            # List files in the invoice's storage folder
            # Path format: {organization_id}/invoices/{invoice_id}/
            folder_path = f"{organization_id}/invoices/{invoice_id}"
            files = await storage_service.list_files(
                bucket="production-files",
                path=folder_path
            )

            if not files:
                return None

            # Find the most recent PDF file
            pdf_files = [f for f in files if f.get("name", "").endswith(".pdf")]
            if not pdf_files:
                return None

            # Get the latest PDF (files are usually sorted by upload time)
            latest_pdf = pdf_files[-1]
            pdf_name = latest_pdf.get("name", "")

            if not pdf_name:
                return None

            # Construct full path for signed URL
            file_path = f"{folder_path}/{pdf_name}"

            signed_url = await storage_service.generate_signed_url(
                bucket="production-files",
                file_path=file_path,
                expires_in=expires_in
            )

            return {
                "signed_url": signed_url,
                "file_path": file_path,
            }

        except Exception as e:
            logger.warning(f"Failed to check existing PDF for invoice {invoice_id}: {e}")
            return None


# Global service instance
invoice_pdf_service = InvoicePDFService()
