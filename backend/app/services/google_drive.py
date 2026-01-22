import logging
import io
from typing import Dict, Any, Optional, List
from uuid import UUID
import asyncio
from datetime import datetime

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.models.cloud import GoogleDriveCredentials, ProjectDriveFolder, CloudSyncStatus
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """
    Google Drive integration service for file synchronization.
    Handles folder creation, file uploads, and organization-specific folder structures.
    """

    SCOPES = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata'
    ]

    def __init__(self):
        self._service = None
        self._credentials = None

    async def _get_drive_service(self, organization_id: UUID, db: AsyncSession):
        """Get authenticated Google Drive service for organization."""
        # Check if we have cached service
        if self._service and self._credentials and self._credentials.organization_id == organization_id:
            return self._service

        # Validate service account file exists
        import os
        if not os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
            raise ValueError(f"Google Drive service account file not found: {settings.GOOGLE_APPLICATION_CREDENTIALS}")

        # Check if organization has Google Drive configured (for folder management)
        credentials_query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(credentials_query)
        creds_record = result.scalar_one_or_none()

        # Create credentials record if it doesn't exist
        if not creds_record:
            creds_record = GoogleDriveCredentials(
                organization_id=organization_id,
                auto_sync_enabled=True,
                sync_on_proposal_approval=True,
                sync_on_call_sheet_finalized=True
            )
            db.add(creds_record)
            await db.commit()
            await db.refresh(creds_record)

        # Initialize service account credentials from file
        try:
            credentials = service_account.Credentials.from_service_account_file(
                settings.GOOGLE_APPLICATION_CREDENTIALS,
                scopes=self.SCOPES
            )
        except Exception as e:
            raise ValueError(f"Failed to load Google Drive service account credentials: {str(e)}")

        # Build the service
        self._service = build('drive', 'v3', credentials=credentials)
        self._credentials = creds_record

        return self._service

    async def _ensure_organization_folder(self, organization_id: UUID, org_name: str, db: AsyncSession):
        """Ensure organization root folder exists in Google Drive."""
        service = await self._get_drive_service(organization_id, db)

        # Check if we already have the folder ID stored
        if self._credentials.root_folder_id:
            try:
                # Verify the folder still exists
                file_metadata = service.files().get(fileId=self._credentials.root_folder_id).execute()
                return self._credentials.root_folder_id, file_metadata.get('webViewLink')
            except HttpError as e:
                if e.resp.status == 404:
                    # Folder was deleted, recreate it
                    pass
                else:
                    raise

        # Create the root folder: SafeTasks_V3/{org_name}
        folder_name = f"SafeTasks_V3/{org_name}"

        # Create folder metadata
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': []  # Root level
        }

        try:
            folder = service.files().create(
                body=folder_metadata,
                fields='id,webViewLink'
            ).execute()

            folder_id = folder.get('id')
            folder_url = folder.get('webViewLink')

            # Update database with folder ID
            self._credentials.root_folder_id = folder_id
            self._credentials.root_folder_url = folder_url
            db.add(self._credentials)
            await db.commit()

            logger.info(f"Created Google Drive folder: {folder_name} (ID: {folder_id})")
            return folder_id, folder_url

        except HttpError as e:
            logger.error(f"Failed to create organization folder: {str(e)}")
            raise

    async def _ensure_project_folders(self, organization_id: UUID, project_id: UUID,
                                    project_name: str, db: AsyncSession):
        """Ensure project folder structure exists in Google Drive."""
        service = await self._get_drive_service(organization_id, db)

        # Get organization folder first
        from app.models.organizations import Organization
        org_query = select(Organization).where(Organization.id == organization_id)
        org_result = await db.execute(org_query)
        org = org_result.scalar_one_or_none()

        if not org:
            raise ValueError(f"Organization not found: {organization_id}")

        root_folder_id, _ = await self._ensure_organization_folder(organization_id, org.name, db)

        # Check if project folders already exist
        project_folders_query = select(ProjectDriveFolder).where(
            ProjectDriveFolder.organization_id == organization_id,
            ProjectDriveFolder.project_id == project_id
        )
        folders_result = await db.execute(project_folders_query)
        project_folders = folders_result.scalar_one_or_none()

        if project_folders and project_folders.project_folder_id:
            try:
                # Verify the folder still exists
                service.files().get(fileId=project_folders.project_folder_id).execute()
                return project_folders
            except HttpError as e:
                if e.resp.status == 404:
                    # Folder was deleted, recreate it
                    pass
                else:
                    raise

        # Create project root folder
        project_folder_name = project_name.replace('/', '_').replace('\\', '_')
        project_folder_metadata = {
            'name': project_folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [root_folder_id]
        }

        project_folder = service.files().create(
            body=project_folder_metadata,
            fields='id,webViewLink'
        ).execute()

        # Create subfolders
        subfolders = {
            'scripts': 'Scripts',
            'call_sheets': 'Call Sheets',
            'media': 'Media'
        }

        folder_ids = {}
        folder_urls = {}

        for key, name in subfolders.items():
            subfolder_metadata = {
                'name': name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [project_folder.get('id')]
            }

            subfolder = service.files().create(
                body=subfolder_metadata,
                fields='id,webViewLink'
            ).execute()

            folder_ids[f"{key}_folder_id"] = subfolder.get('id')
            folder_urls[f"{key}_folder_url"] = subfolder.get('webViewLink')

        # Save to database
        if project_folders:
            # Update existing record
            project_folders.project_folder_id = project_folder.get('id')
            project_folders.project_folder_url = project_folder.get('webViewLink')
            for key, value in folder_ids.items():
                setattr(project_folders, key, value)
            for key, value in folder_urls.items():
                setattr(project_folders, key, value)
        else:
            # Create new record
            project_folders = ProjectDriveFolder(
                organization_id=organization_id,
                project_id=project_id,
                project_folder_id=project_folder.get('id'),
                project_folder_url=project_folder.get('webViewLink'),
                **folder_ids,
                **folder_urls
            )
            db.add(project_folders)

        await db.commit()
        logger.info(f"Created project folder structure for: {project_name}")
        return project_folders

    def _get_folder_for_module(self, project_folders: ProjectDriveFolder, module: str) -> str:
        """Get the appropriate folder ID for a given module."""
        folder_mapping = {
            'proposals': project_folders.scripts_folder_id,
            'scripts': project_folders.scripts_folder_id,
            'call_sheets': project_folders.call_sheets_folder_id,
            'media': project_folders.media_folder_id
        }

        folder_id = folder_mapping.get(module, project_folders.project_folder_id)
        if not folder_id:
            # Fallback to project root folder
            folder_id = project_folders.project_folder_id

        return folder_id

    async def upload_file(self, organization_id: UUID, project_id: UUID, project_name: str,
                         file_content: bytes, file_name: str, mime_type: str,
                         module: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Upload a file to the appropriate Google Drive folder.
        """
        try:
            # Ensure folder structure exists
            project_folders = await self._ensure_project_folders(
                organization_id, project_id, project_name, db
            )

            # Get the target folder for this module
            target_folder_id = self._get_folder_for_module(project_folders, module)

            # Create file metadata
            file_metadata = {
                'name': file_name,
                'parents': [target_folder_id]
            }

            # Create media upload
            media = MediaIoBaseUpload(
                io.BytesIO(file_content),
                mimetype=mime_type,
                resumable=True
            )

            # Upload file
            service = await self._get_drive_service(organization_id, db)
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink,name,size,createdTime'
            ).execute()

            return {
                'file_id': file.get('id'),
                'file_url': file.get('webViewLink'),
                'file_name': file.get('name'),
                'file_size': file.get('size'),
                'created_time': file.get('createdTime'),
                'folder_id': target_folder_id
            }

        except HttpError as e:
            logger.error(f"Google Drive upload failed: {str(e)}")
            raise ValueError(f"Failed to upload file to Google Drive: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during Google Drive upload: {str(e)}")
            raise

    async def get_file_info(self, organization_id: UUID, file_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Get information about a file in Google Drive."""
        try:
            service = await self._get_drive_service(organization_id, db)
            file_info = service.files().get(fileId=file_id, fields='id,webViewLink,name,size,createdTime,modifiedTime').execute()

            return {
                'file_id': file_info.get('id'),
                'file_url': file_info.get('webViewLink'),
                'file_name': file_info.get('name'),
                'file_size': file_info.get('size'),
                'created_time': file_info.get('createdTime'),
                'modified_time': file_info.get('modifiedTime')
            }

        except HttpError as e:
            if e.resp.status == 404:
                raise ValueError(f"File not found in Google Drive: {file_id}")
            raise ValueError(f"Failed to get file info: {str(e)}")

    async def delete_file(self, organization_id: UUID, file_id: str, db: AsyncSession) -> bool:
        """Delete a file from Google Drive."""
        try:
            service = await self._get_drive_service(organization_id, db)
            service.files().delete(fileId=file_id).execute()
            return True

        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"File already deleted or not found: {file_id}")
                return True
            raise ValueError(f"Failed to delete file: {str(e)}")

    async def list_folder_contents(self, organization_id: UUID, folder_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """List contents of a Google Drive folder."""
        try:
            service = await self._get_drive_service(organization_id, db)

            query = f"'{folder_id}' in parents and trashed = false"
            results = service.files().list(
                q=query,
                fields="files(id, name, webViewLink, mimeType, size, createdTime, modifiedTime)"
            ).execute()

            files = results.get('files', [])
            return [
                {
                    'id': f.get('id'),
                    'name': f.get('name'),
                    'url': f.get('webViewLink'),
                    'mime_type': f.get('mimeType'),
                    'size': f.get('size'),
                    'created_time': f.get('createdTime'),
                    'modified_time': f.get('modifiedTime')
                }
                for f in files
            ]

        except HttpError as e:
            raise ValueError(f"Failed to list folder contents: {str(e)}")


# Global Google Drive service instance
google_drive_service = GoogleDriveService()
