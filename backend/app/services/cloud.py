import logging
import asyncio
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.services.google_drive import google_drive_service
from app.services.storage import storage_service
from app.models.cloud import CloudSyncStatus, GoogleDriveCredentials
from app.models.projects import Project

logger = logging.getLogger(__name__)


class CloudSyncService:
    """
    Cloud synchronization service with real Google Drive integration.
    Handles file uploads to cloud providers with organization-specific folder structures.
    """

    def __init__(self):
        pass

    async def _get_project_info(self, project_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Get project information for sync operations."""
        project_query = select(Project).where(Project.id == project_id)
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()

        if not project:
            raise ValueError(f"Project not found: {project_id}")

        return {
            "id": project.id,
            "title": project.title,
            "organization_id": project.organization_id
        }

    async def _record_sync_status(self, sync_data: Dict[str, Any], db: AsyncSession):
        """Record the sync status in the database."""
        sync_status = CloudSyncStatus(**sync_data)
        db.add(sync_status)
        await db.commit()
        await db.refresh(sync_status)
        return sync_status

    async def _update_sync_status(self, sync_id: UUID, status: str, error_message: str = None, db: AsyncSession = None):
        """Update sync status."""
        if db:
            update_query = (
                update(CloudSyncStatus)
                .where(CloudSyncStatus.id == sync_id)
                .values(
                    sync_status=status,
                    sync_completed_at=datetime.now() if status == "completed" else None,
                    error_message=error_message
                )
            )
            await db.execute(update_query)
            await db.commit()

    async def sync_file_to_drive(self, file_id: UUID, project_id: UUID, module: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Sync a file from Supabase Storage to Google Drive.

        Args:
            file_id: Supabase Storage file ID
            project_id: Project ID for folder organization
            module: Module type (proposals, call_sheets, scripts, media)
            db: Database session

        Returns:
            Sync result information
        """
        # Get project information
        project = await self._get_project_info(project_id, db)

        # Record sync start
        sync_record = await self._record_sync_status({
            "organization_id": project["organization_id"],
            "file_id": file_id,
            "project_id": project_id,
            "module": module,
            "provider": "google_drive",
            "sync_started_at": datetime.now()
        }, db)

        try:
            # Download file from Supabase Storage
            file_content, file_info = await storage_service.download_file(
                organization_id=project["organization_id"],
                file_id=file_id
            )

            # Upload to Google Drive
            drive_result = await google_drive_service.upload_file(
                organization_id=project["organization_id"],
                project_id=project_id,
                project_name=project["title"],
                file_content=file_content,
                file_name=file_info["file_name"],
                mime_type=file_info["mime_type"],
                module=module,
                db=db
            )

            # Update sync record with success
            await self._update_sync_status(
                sync_record.id,
                "completed",
                db=db
            )

            # Update sync record with external IDs
            update_query = (
                update(CloudSyncStatus)
                .where(CloudSyncStatus.id == sync_record.id)
                .values(
                    external_id=drive_result["file_id"],
                    external_url=drive_result["file_url"],
                    file_path=file_info.get("file_path"),
                    file_name=file_info["file_name"]
                )
            )
            await db.execute(update_query)
            await db.commit()

            logger.info(f"Successfully synced file {file_id} to Google Drive: {drive_result['file_url']}")

            return {
                "sync_id": str(sync_record.id),
                "provider": "google_drive",
                "status": "completed",
                "external_id": drive_result["file_id"],
                "external_url": drive_result["file_url"],
                "file_name": drive_result["file_name"],
                "file_size": drive_result["file_size"],
                "synced_at": drive_result["created_time"]
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to sync file {file_id} to Google Drive: {error_msg}")

            # Update sync record with failure
            await self._update_sync_status(
                sync_record.id,
                "failed",
                error_msg,
                db=db
            )

            return {
                "sync_id": str(sync_record.id),
                "provider": "google_drive",
                "status": "failed",
                "error": error_msg
            }

    async def sync_project_files(self, project_id: UUID, modules: List[str] = None, db: AsyncSession = None) -> Dict[str, Any]:
        """
        Sync all files for a project to cloud storage.

        Args:
            project_id: Project ID
            modules: List of modules to sync (default: all)
            db: Database session

        Returns:
            Sync results summary
        """
        if modules is None:
            modules = ["proposals", "call_sheets", "scripts", "media"]

        # Get project information
        project = await self._get_project_info(project_id, db)

        results = {
            "project_id": str(project_id),
            "organization_id": str(project["organization_id"]),
            "modules_synced": modules,
            "sync_results": [],
            "total_files": 0,
            "successful_syncs": 0,
            "failed_syncs": 0
        }

        # Sync files for each module
        for module in modules:
            try:
                # Get files for this module (this would need to be implemented based on your storage structure)
                # For now, this is a placeholder that would need to be adapted to your actual file storage
                module_files = await self._get_module_files(project["organization_id"], project_id, module, db)

                for file_info in module_files:
                    sync_result = await self.sync_file_to_drive(
                        file_id=file_info["file_id"],
                        project_id=project_id,
                        module=module,
                        db=db
                    )

                    results["sync_results"].append(sync_result)
                    results["total_files"] += 1

                    if sync_result["status"] == "completed":
                        results["successful_syncs"] += 1
                    else:
                        results["failed_syncs"] += 1

                    # Small delay to avoid rate limiting
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(f"Failed to sync {module} files for project {project_id}: {str(e)}")
                results["sync_results"].append({
                    "module": module,
                    "status": "error",
                    "error": str(e)
                })

        return results

    async def _get_module_files(self, organization_id: UUID, project_id: UUID, module: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Get files for a specific module. This needs to be implemented based on your storage structure.
        For now, returns empty list - you would implement this based on your actual file storage.
        """
        # Placeholder implementation
        # In a real implementation, this would query your storage/file tables
        # to find files related to the specific module and project

        logger.warning(f"_get_module_files not implemented for module: {module}")
        return []

    async def get_sync_status(self, organization_id: UUID, file_path: str = None, project_id: UUID = None, db: AsyncSession = None) -> Dict[str, Any]:
        """
        Get synchronization status for files.

        Args:
            organization_id: Organization ID
            file_path: Specific file path (optional)
            project_id: Project ID (optional)
            db: Database session

        Returns:
            Sync status information
        """
        if not db:
            raise ValueError("Database session required for sync status")

        query = select(CloudSyncStatus).where(CloudSyncStatus.organization_id == organization_id)

        if file_path:
            query = query.where(CloudSyncStatus.file_path == file_path)
        if project_id:
            query = query.where(CloudSyncStatus.project_id == project_id)

        result = await db.execute(query)
        sync_records = result.scalars().all()

        return {
            "organization_id": str(organization_id),
            "file_path": file_path,
            "project_id": str(project_id) if project_id else None,
            "sync_records": [
                {
                    "id": str(record.id),
                    "file_name": record.file_name,
                    "provider": record.provider,
                    "sync_status": record.sync_status,
                    "external_url": record.external_url,
                    "sync_started_at": record.sync_started_at.isoformat() if record.sync_started_at else None,
                    "sync_completed_at": record.sync_completed_at.isoformat() if record.sync_completed_at else None,
                    "error_message": record.error_message
                }
                for record in sync_records
            ],
            "total_records": len(sync_records)
        }

    async def sync_to_google_drive(
        self,
        organization_id: UUID,
        file_path: str,
        file_name: str,
        bucket: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Legacy method for backward compatibility.
        Use sync_file_to_drive for new implementations.
        """
        logger.warning("sync_to_google_drive is deprecated. Use sync_file_to_drive instead.")
        return await self.sync_file_to_drive(
            file_id=UUID(file_path.split('/')[-1]),  # Extract file ID from path
            project_id=metadata.get("project_id") if metadata else None,
            module=metadata.get("module", "misc") if metadata else "misc",
            db=None  # This would need to be passed in new implementations
        )

    async def sync_to_dropbox(
        self,
        organization_id: UUID,
        file_path: str,
        file_name: str,
        bucket: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Placeholder for Dropbox sync (not implemented).
        """
        logger.info(f"DROPBOX_SYNC: Dropbox sync not implemented for {file_name}")

        return {
            "provider": "dropbox",
            "status": "not_implemented",
            "message": "Dropbox sync is not yet implemented"
        }

    async def sync_production_assets(
        self,
        organization_id: UUID,
        module: str,
        file_path: str,
        file_name: str,
        providers: list = None
    ) -> Dict[str, Any]:
        """
        Sync production assets to multiple cloud providers.
        """
        if providers is None:
            providers = ["google_drive"]

        results = {}

        for provider in providers:
            try:
                if provider == "google_drive":
                    # This would need database session - placeholder for now
                    results[provider] = {
                        "provider": provider,
                        "status": "requires_db_session",
                        "message": "Use sync_file_to_drive method instead"
                    }
                else:
                    results[provider] = {
                        "provider": provider,
                        "status": "not_implemented"
                    }

            except Exception as e:
                logger.error(f"Failed to sync to {provider}: {str(e)}")
                results[provider] = {
                    "provider": provider,
                    "status": "error",
                    "error": str(e)
                }

        return results


# Global cloud sync service instance
cloud_sync_service = CloudSyncService()
