import os
import uuid
from typing import Optional, Dict, Any
from pathlib import Path

from supabase import create_client, Client
from app.core.config import settings


class StorageService:
    """Service for handling file uploads and storage operations with Supabase Storage."""

    def __init__(self):
        # Lazy initialization - only check environment variables when needed
        self._supabase: Optional[Client] = None
        self._initialized = False

        # Bucket configurations
        self.buckets = {
            "public-assets": {
                "public": True,
                "allowed_types": ["image/jpeg", "image/png", "image/webp"],
                "max_size_mb": 10
            },
            "production-files": {
                "public": False,
                "allowed_types": ["application/pdf", "text/plain", "text/markdown", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
                "max_size_mb": 25
            }
        }

    def _get_supabase_client(self) -> Client:
        """Get or create Supabase client with lazy initialization."""
        if not self._initialized:
            if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
                )

            self._supabase = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_KEY
            )
            self._initialized = True

        return self._supabase

    def _get_file_path(self, organization_id: str, module: str, filename: str) -> str:
        """Generate a multi-tenant file path: /{organization_id}/{module}/{filename}"""
        # Sanitize filename and ensure unique name
        file_stem = Path(filename).stem
        file_suffix = Path(filename).suffix
        unique_filename = f"{file_stem}_{uuid.uuid4().hex[:8]}{file_suffix}"

        return f"{organization_id}/{module}/{unique_filename}"

    def _validate_file(self, file_content: bytes, filename: str, bucket: str) -> None:
        """Validate file type and size."""
        if bucket not in self.buckets:
            raise ValueError(f"Invalid bucket: {bucket}")

        bucket_config = self.buckets[bucket]

        # Check file size
        max_size_bytes = bucket_config["max_size_mb"] * 1024 * 1024
        if len(file_content) > max_size_bytes:
            raise ValueError(f"File too large. Maximum size: {bucket_config['max_size_mb']}MB")

        # Check file type (basic check)
        content_type = self._guess_content_type(filename)
        if content_type not in bucket_config["allowed_types"]:
            raise ValueError(f"File type not allowed: {content_type}")

    def _guess_content_type(self, filename: str) -> str:
        """Guess content type from filename extension."""
        ext = Path(filename).suffix.lower()
        content_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        return content_types.get(ext, "application/octet-stream")

    async def upload_file(
        self,
        organization_id: str,
        module: str,
        filename: str,
        file_content: bytes,
        bucket: str = "production-files"
    ) -> Dict[str, Any]:
        """
        Upload a file to Supabase Storage with multi-tenant path.

        Args:
            organization_id: The organization ID for multi-tenancy
            module: The module name (e.g., 'kits', 'scripts', 'call-sheets')
            filename: Original filename
            file_content: File content as bytes
            bucket: Storage bucket ('public-assets' or 'production-files')

        Returns:
            Dict with file path and access URL
        """
        try:
            # Validate file
            self._validate_file(file_content, filename, bucket)

            # Generate multi-tenant file path
            file_path = self._get_file_path(organization_id, module, filename)

            # Upload to Supabase Storage
            supabase_client = self._get_supabase_client()
            response = supabase_client.storage.from_(bucket).upload(
                path=file_path,
                file=file_content,
                file_options={
                    "content-type": self._guess_content_type(filename),
                    "cache-control": "3600"
                }
            )

            # The response object structure varies by client version
            # Check if upload was successful (response should have path or error)
            if hasattr(response, 'path') or (isinstance(response, dict) and 'path' in response):
                # Upload successful
                pass
            else:
                # Check for error
                error_msg = getattr(response, 'error', response.get('error') if isinstance(response, dict) else None)
                if error_msg:
                    raise Exception(f"Upload failed: {error_msg}")

            # Generate access URL
            bucket_config = self.buckets[bucket]
            if bucket_config["public"]:
                # Public bucket - direct URL
                access_url = supabase_client.storage.from_(bucket).get_public_url(file_path)
            else:
                # Private bucket - will need signed URL
                access_url = None  # Will be generated on demand

            return {
                "file_path": file_path,
                "bucket": bucket,
                "access_url": access_url,
                "is_public": bucket_config["public"],
                "size_bytes": len(file_content),
                "content_type": self._guess_content_type(filename)
            }

        except Exception as e:
            raise Exception(f"File upload failed: {str(e)}")

    async def delete_file(self, bucket: str, file_path: str) -> bool:
        """
        Delete a file from Supabase Storage.

        Args:
            bucket: Storage bucket
            file_path: Full file path

        Returns:
            True if deleted successfully
        """
        try:
            supabase_client = self._get_supabase_client()
            response = supabase_client.storage.from_(bucket).remove([file_path])

            # Check if deletion was successful
            # Response is usually a list of deleted file info or an error object
            if isinstance(response, list) and len(response) > 0:
                return True
            elif hasattr(response, 'error') or (isinstance(response, dict) and 'error' in response):
                error_msg = getattr(response, 'error', response.get('error'))
                raise Exception(f"Delete failed: {error_msg}")

            return True

        except Exception as e:
            raise Exception(f"File deletion failed: {str(e)}")

    async def get_file_size(self, bucket: str, file_path: str) -> Optional[int]:
        """
        Return file size in bytes if available, otherwise None.
        """
        try:
            supabase_client = self._get_supabase_client()
            parts = file_path.split("/")
            if len(parts) < 2:
                return None
            directory = "/".join(parts[:-1])
            filename = parts[-1]
            entries = supabase_client.storage.from_(bucket).list(directory)
            if not isinstance(entries, list):
                return None
            for entry in entries:
                if entry.get("name") == filename:
                    metadata = entry.get("metadata") or {}
                    size = metadata.get("size")
                    if isinstance(size, int):
                        return size
            return None
        except Exception:
            return None

    async def generate_signed_url(
        self,
        bucket: str,
        file_path: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate a signed URL for private files.

        Args:
            bucket: Storage bucket
            file_path: Full file path
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Signed URL string
        """
        try:
            supabase_client = self._get_supabase_client()
            response = supabase_client.storage.from_(bucket).create_signed_url(
                path=file_path,
                expires_in=expires_in
            )

            if response.get("signedURL"):
                return response["signedURL"]
            else:
                raise Exception(f"Failed to generate signed URL: {response}")

        except Exception as e:
            raise Exception(f"Signed URL generation failed: {str(e)}")

    async def get_file_info(self, bucket: str, file_path: str) -> Dict[str, Any]:
        """
        Get file information from storage.

        Args:
            bucket: Storage bucket
            file_path: Full file path

        Returns:
            File metadata
        """
        try:
            supabase_client = self._get_supabase_client()
            
            # List all files in the parent directory
            folder_path = str(Path(file_path).parent)
            if folder_path == ".":
                folder_path = ""

            response = supabase_client.storage.from_(bucket).list(path=folder_path)

            # Find the specific file by name
            filename = Path(file_path).name
            if response:
                for file_obj in response:
                    file_name = file_obj.get('name') if isinstance(file_obj, dict) else getattr(file_obj, 'name', None)
                    if file_name == filename:
                        return file_obj if isinstance(file_obj, dict) else {
                            'name': file_name,
                            'id': getattr(file_obj, 'id', None),
                            'size': getattr(file_obj, 'metadata', {}).get('size', None)
                        }

            raise Exception("File not found")

        except Exception as e:
            raise Exception(f"File info retrieval failed: {str(e)}")

    async def list_files(self, bucket: str, path: str) -> list[Dict[str, Any]]:
        """
        List files in a specific path.

        Args:
            bucket: Storage bucket
            path: Directory path to list files from

        Returns:
            List of file objects with metadata
        """
        try:
            supabase_client = self._get_supabase_client()
            response = supabase_client.storage.from_(bucket).list(path=path)
            return response or []
        except Exception as e:
            raise Exception(f"File listing failed: {str(e)}")


# Global storage service instance
storage_service = StorageService()
