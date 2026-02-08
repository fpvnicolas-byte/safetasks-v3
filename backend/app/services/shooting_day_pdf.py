"""
Shooting Day PDF Generation Service

This service handles rendering shooting days to HTML and generating PDFs
using Jinja2 templates and WeasyPrint.
Based on the invoice PDF generation system.
"""

import logging
import re
from pathlib import Path
from typing import Optional, Any, Dict, List
from datetime import datetime, timezone

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Template directory path
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "shooting_days"

# i18n translations for shooting day PDF
SHOOTING_DAY_PDF_TRANSLATIONS = {
    "pt-BR": {
        "shooting_day": "Dia de Filmagem",
        "schedule": "Cronograma",
        "call_time": "Chamada",
        "on_set": "No Set",
        "lunch_time": "Almoço",
        "wrap_time": "Encerramento",
        "location": "Localização",
        "location_name": "Local",
        "location_address": "Endereço",
        "parking_info": "Estacionamento",
        "crew": "Equipe",
        "name": "Nome",
        "function": "Função",
        "phone": "Telefone",
        "email": "E-mail",
        "scenes": "Cenas",
        "scene_number": "Nº",
        "heading": "Descrição",
        "int_ext": "INT/EXT",
        "day_night": "Dia/Noite",
        "estimated_time": "Tempo Est.",
        "safety": "Segurança",
        "hospital_info": "Hospital de Referência",
        "notes": "Observações",
        "production_notes": "Notas de Produção",
        "total_estimated_time": "Tempo Total Estimado",
        "minutes": "min",
        "generated_at": "Documento gerado em",
        "page": "Página",
        "of": "de",
        "project": "Projeto",
        "date": "Data",
        "status": "Status",
        "status_draft": "Rascunho",
        "status_confirmed": "Confirmado",
        "status_in_progress": "Em Andamento",
        "status_completed": "Concluído",
        "status_cancelled": "Cancelado",
        "int": "INT",
        "ext": "EXT",
        "day": "Dia",
        "night": "Noite",
        "no_crew": "Nenhuma equipe atribuída",
        "no_scenes": "Nenhuma cena atribuída",
    },
    "en": {
        "shooting_day": "Shooting Day",
        "schedule": "Schedule",
        "call_time": "Call Time",
        "on_set": "On Set",
        "lunch_time": "Lunch",
        "wrap_time": "Wrap",
        "location": "Location",
        "location_name": "Location",
        "location_address": "Address",
        "parking_info": "Parking",
        "crew": "Crew",
        "name": "Name",
        "function": "Function",
        "phone": "Phone",
        "email": "Email",
        "scenes": "Scenes",
        "scene_number": "No.",
        "heading": "Description",
        "int_ext": "INT/EXT",
        "day_night": "Day/Night",
        "estimated_time": "Est. Time",
        "safety": "Safety",
        "hospital_info": "Reference Hospital",
        "notes": "Notes",
        "production_notes": "Production Notes",
        "total_estimated_time": "Total Estimated Time",
        "minutes": "min",
        "generated_at": "Document generated on",
        "page": "Page",
        "of": "of",
        "project": "Project",
        "date": "Date",
        "status": "Status",
        "status_draft": "Draft",
        "status_confirmed": "Confirmed",
        "status_in_progress": "In Progress",
        "status_completed": "Completed",
        "status_cancelled": "Cancelled",
        "int": "INT",
        "ext": "EXT",
        "day": "Day",
        "night": "Night",
        "no_crew": "No crew assigned",
        "no_scenes": "No scenes assigned",
    },
}


class ShootingDayPDFService:
    """Service for generating professional PDF shooting day schedules."""

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
            self._jinja_env.filters["format_time"] = self._format_time
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
    def _format_time(time_value: Optional[Any]) -> str:
        """
        Format time value for display.

        Args:
            time_value: Time value (datetime.time or string)

        Returns:
            Formatted time string (HH:MM)
        """
        if time_value is None:
            return "-"
        
        if isinstance(time_value, str):
            return time_value
        
        # If it's a time object
        if hasattr(time_value, 'strftime'):
            return time_value.strftime("%H:%M")
        
        return str(time_value)

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
            return SHOOTING_DAY_PDF_TRANSLATIONS["pt-BR"]
        elif normalized.startswith("en"):
            return SHOOTING_DAY_PDF_TRANSLATIONS["en"]
        else:
            # Default to Portuguese (primary user base)
            return SHOOTING_DAY_PDF_TRANSLATIONS["pt-BR"]

    @staticmethod
    def _translate_status(status: str, locale: str = "pt-BR") -> str:
        """Translate shooting day status."""
        translations = ShootingDayPDFService._get_translations(locale)
        key = f"status_{status}"
        return translations.get(key, status.replace("_", " ").title())

    @staticmethod
    def _translate_int_ext(value: Optional[str], locale: str = "pt-BR") -> str:
        """Translate INT/EXT value."""
        if not value:
            return "-"
        translations = ShootingDayPDFService._get_translations(locale)
        return translations.get(value.lower(), value.upper())

    @staticmethod
    def _translate_day_night(value: Optional[str], locale: str = "pt-BR") -> str:
        """Translate Day/Night value."""
        if not value:
            return "-"
        translations = ShootingDayPDFService._get_translations(locale)
        return translations.get(value.lower(), value.title())

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
        shooting_day: Any,
        organization: Any,
        project: Any,
        scenes: List[Any],
        crew_assignments: List[Any],
        locale: str = "pt-BR"
    ) -> str:
        """
        Render shooting day data to HTML using Jinja2 template.

        Args:
            shooting_day: ShootingDay model instance
            organization: Organization model instance
            project: Project model instance
            scenes: List of Scene model instances
            crew_assignments: List of CrewAssignment instances with profile data
            locale: Locale for formatting (default: pt-BR)

        Returns:
            Rendered HTML string
        """
        template = self.jinja_env.get_template("shooting_day.html")

        # Get translations
        translations = self._get_translations(locale)

        # Calculate total estimated time
        total_minutes = sum(
            scene.estimated_time or 0 
            for scene in scenes
        )

        context = {
            "shooting_day": shooting_day,
            "organization": organization,
            "project": project,
            "scenes": scenes,
            "crew_assignments": crew_assignments,
            "total_estimated_time": total_minutes,
            "logo_url": self._get_logo_path(organization),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "locale": locale,
            "t": translations,
            "translate_status": lambda s: self._translate_status(s, locale),
            "translate_int_ext": lambda v: self._translate_int_ext(v, locale),
            "translate_day_night": lambda v: self._translate_day_night(v, locale),
        }

        rendered = template.render(**context)
        logger.debug(f"Rendered HTML for shooting day {shooting_day.id}")

        return rendered

    async def generate_pdf(
        self,
        shooting_day: Any,
        organization: Any,
        project: Any,
        scenes: List[Any],
        crew_assignments: List[Any],
        locale: str = "pt-BR"
    ) -> bytes:
        """
        Generate PDF bytes from shooting day data.

        Args:
            shooting_day: ShootingDay model instance
            organization: Organization model instance
            project: Project model instance
            scenes: List of Scene model instances
            crew_assignments: List of CrewAssignment instances
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
            shooting_day=shooting_day,
            organization=organization,
            project=project,
            scenes=scenes,
            crew_assignments=crew_assignments,
            locale=locale
        )

        # Load CSS file
        css_path = TEMPLATE_DIR / "shooting_day.css"
        stylesheets = []
        if css_path.exists():
            stylesheets.append(CSS(filename=str(css_path)))

        # Generate PDF
        html_doc = HTML(string=html_content, base_url=str(TEMPLATE_DIR))
        pdf_bytes = html_doc.write_pdf(stylesheets=stylesheets if stylesheets else None)

        logger.info(f"Generated PDF for shooting day {shooting_day.id} ({len(pdf_bytes)} bytes)")

        return pdf_bytes

    async def generate_and_store(
        self,
        db: Any,
        shooting_day: Any,
        organization: Any,
        project: Any,
        scenes: List[Any],
        crew_assignments: List[Any],
        locale: str = "pt-BR"
    ) -> Dict[str, Any]:
        """
        Generate PDF and upload to storage.

        Args:
            db: Database session
            shooting_day: ShootingDay model instance
            organization: Organization model instance
            project: Project model instance
            scenes: List of Scene model instances
            crew_assignments: List of CrewAssignment instances
            locale: Locale for formatting

        Returns:
            Dict with PDF path, bucket, size, and signed URL
        """
        from app.services.storage import storage_service

        # Generate PDF
        pdf_bytes = await self.generate_pdf(
            shooting_day=shooting_day,
            organization=organization,
            project=project,
            scenes=scenes,
            crew_assignments=crew_assignments,
            locale=locale
        )

        # Create friendly filename: ShootingDay_ProjectName_Date.pdf
        def sanitize_filename(name: str) -> str:
            # Replace spaces with underscores and remove non-alphanumeric chars (except -_)
            name = re.sub(r'\s+', '_', name)
            return re.sub(r'[^\w\-_]', '', name)

        project_name = sanitize_filename(project.title if project else "Project")
        date_str = shooting_day.date.strftime("%Y-%m-%d") if shooting_day.date else datetime.now().strftime("%Y-%m-%d")

        filename = f"ShootingDay_{project_name}_{date_str}.pdf"

        # Upload to storage (using shooting_day ID as entity_id for folder organization)
        upload_result = await storage_service.upload_file(
            organization_id=str(shooting_day.organization_id),
            module="shooting_days",
            filename=filename,
            file_content=pdf_bytes,
            bucket="production-files",
            entity_id=str(shooting_day.id)
        )

        # Generate signed URL for download
        signed_url = await storage_service.generate_signed_url(
            bucket=upload_result["bucket"],
            file_path=upload_result["file_path"],
            expires_in=3600  # 1 hour
        )

        logger.info(
            f"Stored PDF for shooting day {shooting_day.id} at {upload_result['file_path']}"
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
        shooting_day_id: str,
        expires_in: int = 3600
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a PDF exists for this shooting day in storage and return its signed URL.

        Args:
            organization_id: Organization UUID string
            shooting_day_id: ShootingDay UUID string
            expires_in: URL expiration in seconds

        Returns:
            Dict with signed_url and file info, or None if no PDF exists
        """
        from app.services.storage import storage_service

        try:
            # List files in the shooting day's storage folder
            # Path format: {organization_id}/shooting_days/{shooting_day_id}/
            folder_path = f"{organization_id}/shooting_days/{shooting_day_id}"
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
            logger.warning(f"Failed to check existing PDF for shooting day {shooting_day_id}: {e}")
            return None


# Global service instance
shooting_day_pdf_service = ShootingDayPDFService()
