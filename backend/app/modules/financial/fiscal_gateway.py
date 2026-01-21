from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from datetime import datetime
import httpx

from app.core.config import settings


class FiscalProviderInterface(ABC):
    """
    Abstract base class for fiscal providers (NF-e emission services).
    Implements the Facade pattern for fiscal operations.
    """

    @abstractmethod
    async def emit_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Emit an NF-e invoice.

        Args:
            invoice_data: Invoice data in provider-specific format

        Returns:
            Provider response with status and details
        """
        pass

    @abstractmethod
    async def cancel_invoice(self, invoice_id: str, reason: str) -> Dict[str, Any]:
        """
        Cancel an NF-e invoice.

        Args:
            invoice_id: Provider's invoice ID
            reason: Cancellation reason

        Returns:
            Cancellation response
        """
        pass

    @abstractmethod
    async def get_invoice_status(self, invoice_id: str) -> Dict[str, Any]:
        """
        Get the status of an NF-e invoice.

        Args:
            invoice_id: Provider's invoice ID

        Returns:
            Status information
        """
        pass

    @abstractmethod
    async def download_invoice_files(self, invoice_id: str, file_types: List[str]) -> Dict[str, str]:
        """
        Download invoice files (XML, PDF, DANFE).

        Args:
            invoice_id: Provider's invoice ID
            file_types: List of file types to download

        Returns:
            Dictionary mapping file types to download URLs
        """
        pass


class PlaceholderFiscalProvider(FiscalProviderInterface):
    """
    Placeholder implementation for fiscal provider integration.
    This should be replaced with actual provider implementations like:
    - e-Notas (https://www.enotas.com.br/)
    - FocusNFE (https://www.focusnfe.com.br/)
    - PlugNotas (https://www.plugnotas.com.br/)
    - Or direct SEFAZ integration (not recommended for production)
    """

    def __init__(self):
        """Initialize with configuration."""
        self.api_key = settings.FISCAL_PROVIDER_API_KEY
        self.base_url = "https://api.fiscal-provider.com/v1"  # Placeholder URL
        self.timeout = 30.0

    async def emit_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Placeholder NF-e emission.

        In a real implementation, this would:
        1. Validate invoice data against NF-e requirements
        2. Transform data to provider's format
        3. Call provider's API to emit the invoice
        4. Return authorization details
        """
        # Simulate API call
        print(f"[PLACEHOLDER] Emitting invoice with data: {invoice_data}")

        # Simulate successful emission
        return {
            "success": True,
            "provider_id": f"PROV_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "status": "authorized",
            "authorization_protocol": f"PROTOCOL_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "authorization_date": datetime.utcnow().isoformat(),
            "access_key": f"ACCESS_KEY_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "invoice_number": invoice_data.get("invoice_number", "000001"),
            "series": invoice_data.get("series", "1"),
            "message": "Invoice emitted successfully (PLACEHOLDER)",
            "files": {
                "xml": "https://storage.example.com/xml/placeholder.xml",
                "pdf": "https://storage.example.com/pdf/placeholder.pdf",
                "danfe": "https://storage.example.com/danfe/placeholder.pdf"
            }
        }

    async def cancel_invoice(self, invoice_id: str, reason: str) -> Dict[str, Any]:
        """
        Placeholder NF-e cancellation.

        In a real implementation, this would:
        1. Validate cancellation requirements
        2. Call provider's cancellation API
        3. Return cancellation details
        """
        print(f"[PLACEHOLDER] Cancelling invoice {invoice_id} with reason: {reason}")

        # Simulate successful cancellation
        return {
            "success": True,
            "cancellation_protocol": f"CANCEL_PROTOCOL_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "cancellation_date": datetime.utcnow().isoformat(),
            "status": "cancelled",
            "message": f"Invoice cancelled successfully (PLACEHOLDER): {reason}"
        }

    async def get_invoice_status(self, invoice_id: str) -> Dict[str, Any]:
        """
        Placeholder status check.

        In a real implementation, this would query the provider's API
        for current invoice status.
        """
        print(f"[PLACEHOLDER] Checking status for invoice {invoice_id}")

        # Simulate status response
        return {
            "success": True,
            "status": "authorized",
            "authorization_protocol": f"PROTOCOL_{invoice_id}",
            "authorization_date": datetime.utcnow().isoformat(),
            "last_updated": datetime.utcnow().isoformat(),
            "message": f"Invoice {invoice_id} is authorized (PLACEHOLDER)"
        }

    async def download_invoice_files(self, invoice_id: str, file_types: List[str]) -> Dict[str, str]:
        """
        Placeholder file download.

        In a real implementation, this would generate secure download URLs
        or return file content from the provider.
        """
        print(f"[PLACEHOLDER] Downloading files for invoice {invoice_id}: {file_types}")

        # Simulate file URLs
        base_url = "https://storage.example.com"
        files = {}

        for file_type in file_types:
            if file_type.lower() == "xml":
                files["xml"] = f"{base_url}/xml/{invoice_id}.xml"
            elif file_type.lower() == "pdf":
                files["pdf"] = f"{base_url}/pdf/{invoice_id}.pdf"
            elif file_type.lower() == "danfe":
                files["danfe"] = f"{base_url}/danfe/{invoice_id}.pdf"

        return files


class ENotasFiscalProvider(FiscalProviderInterface):
    """
    Example implementation for e-Notas fiscal provider.
    This is a template for actual provider integration.
    """

    def __init__(self):
        self.api_key = settings.FISCAL_PROVIDER_API_KEY
        self.base_url = "https://api.enotas.com.br/v1"
        self.company_id = "your-company-id"  # Would come from config

    async def emit_invoice(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Real e-Notas NF-e emission implementation."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Transform data to e-Notas format
            enotas_data = self._transform_to_enotas_format(invoice_data)

            response = await client.post(
                f"{self.base_url}/empresas/{self.company_id}/nfe",
                json=enotas_data,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "provider_id": data.get("nfeId"),
                    "status": "processing",
                    "message": "Invoice sent to SEFAZ for authorization"
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "message": "Failed to emit invoice"
                }

    async def cancel_invoice(self, invoice_id: str, reason: str) -> Dict[str, Any]:
        """Real e-Notas NF-e cancellation implementation."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            cancel_data = {"justificativa": reason}

            response = await client.delete(
                f"{self.base_url}/empresas/{self.company_id}/nfe/{invoice_id}",
                json=cancel_data,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )

            return {
                "success": response.status_code == 200,
                "message": response.json() if response.status_code == 200 else response.text
            }

    async def get_invoice_status(self, invoice_id: str) -> Dict[str, Any]:
        """Real e-Notas status check implementation."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/empresas/{self.company_id}/nfe/{invoice_id}",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "status": data.get("status"),
                    "authorization_protocol": data.get("numeroProtocolo"),
                    "authorization_date": data.get("dataAutorizacao"),
                    "access_key": data.get("chaveAcesso"),
                    "message": f"Status: {data.get('status')}"
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "message": "Failed to get invoice status"
                }

    async def download_invoice_files(self, invoice_id: str, file_types: List[str]) -> Dict[str, str]:
        """Real e-Notas file download implementation."""
        files = {}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for file_type in file_types:
                response = await client.get(
                    f"{self.base_url}/empresas/{self.company_id}/nfe/{invoice_id}/downloads/{file_type}",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )

                if response.status_code == 200:
                    # In real implementation, you'd upload to Supabase Storage
                    # and return the Supabase URL
                    files[file_type] = f"data:{file_type};base64,{response.content.decode()}"
                else:
                    files[file_type] = None

        return files

    def _transform_to_enotas_format(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform internal invoice data to e-Notas format."""
        # This would contain the actual transformation logic
        # based on e-Notas API documentation
        return {
            "cliente": {
                "nome": invoice_data.get("recipient_name"),
                "email": invoice_data.get("recipient_email"),
                "cpfCnpj": invoice_data.get("recipient_tax_id")
            },
            "itens": invoice_data.get("items", []),
            "informacoesAdicionais": invoice_data.get("additional_info"),
            # ... more fields as per e-Notas API
        }


# Factory function to get the appropriate fiscal provider
def get_fiscal_provider(provider_name: str = "placeholder") -> FiscalProviderInterface:
    """
    Factory function to get the appropriate fiscal provider implementation.

    Args:
        provider_name: Name of the provider to use

    Returns:
        Fiscal provider instance
    """
    providers = {
        "placeholder": PlaceholderFiscalProvider,
        "enotas": ENotasFiscalProvider,
        # Add more providers as needed
    }

    provider_class = providers.get(provider_name.lower(), PlaceholderFiscalProvider)
    return provider_class()


# Global fiscal provider instance
fiscal_provider = get_fiscal_provider()