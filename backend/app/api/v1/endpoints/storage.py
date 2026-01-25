from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_organization_from_profile
from app.db.session import get_db
from app.services.storage import storage_service
from app.services.cloud import cloud_sync_service
from app.schemas.storage import (
    FileUploadResponse, SignedUrlRequest, SignedUrlResponse,
    CloudSyncRequest, CloudSyncResponse, SyncStatusResponse
)

router = APIRouter()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    organization_id: UUID = Depends(get_organization_from_profile),
    module: str = Form(..., description="Module name: kits, scripts, call-sheets, proposals"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> FileUploadResponse:
    """
    Upload a file to Supabase Storage with multi-tenant path.
    Automatically determines bucket based on file type.
    """
    try:
        # Read file content
        file_content = await file.read()

        # Determine bucket based on module/file type
        if module == "kits":
            bucket = "public-assets"  # Kit photos are public
        else:
            bucket = "production-files"  # Scripts, PDFs, etc. are private

        # Upload file
        result = await storage_service.upload_file(
            organization_id=str(organization_id),
            module=module,
            filename=file.filename,
            file_content=file_content,
            bucket=bucket
        )

        # Optionally sync to cloud providers for production files
        if bucket == "production-files":
            try:
                await cloud_sync_service.sync_production_assets(
                    organization_id=organization_id,
                    module=module,
                    file_path=result["file_path"],
                    file_name=file.filename
                )
            except Exception as e:
                # Log but don't fail the upload if cloud sync fails
                print(f"Cloud sync failed: {str(e)}")

        return FileUploadResponse(**result)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}"
        )


@router.post("/sign-url", response_model=SignedUrlResponse)
async def generate_signed_url(
    request: SignedUrlRequest,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> SignedUrlResponse:
    """
    Generate a temporary signed URL for private files.
    Validates that the file belongs to the requesting organization.
    """
    try:
        # Validate file ownership by checking path prefix
        if not request.file_path.startswith(str(organization_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: file does not belong to your organization"
            )

        signed_url = await storage_service.generate_signed_url(
            bucket=request.bucket,
            file_path=request.file_path,
            expires_in=request.expires_in
        )

        return SignedUrlResponse(
            signed_url=signed_url,
            expires_in=request.expires_in,
            file_path=request.file_path,
            bucket=request.bucket
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signed URL generation failed: {str(e)}"
        )


@router.post("/sync-cloud", response_model=CloudSyncResponse)
async def sync_to_cloud(
    request: CloudSyncRequest,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CloudSyncResponse:
    """
    Sync a file to external cloud providers (Google Drive, Dropbox, etc.).
    """
    try:
        # Validate file ownership
        if not request.file_path.startswith(str(organization_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: file does not belong to your organization"
            )

        # Extract filename from path for logging
        filename = request.file_path.split('/')[-1]

        results = await cloud_sync_service.sync_production_assets(
            organization_id=organization_id,
            module="storage",  # Generic module for storage operations
            file_path=request.file_path,
            file_name=filename,
            providers=request.providers
        )

        return CloudSyncResponse(
            file_path=request.file_path,
            organization_id=str(organization_id),
            results=results
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloud sync failed: {str(e)}"
        )


@router.get("/sync-status/{file_path:path}", response_model=SyncStatusResponse)
async def get_sync_status(
    file_path: str,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> SyncStatusResponse:
    """
    Get synchronization status for a file.
    """
    try:
        # Validate file ownership
        if not file_path.startswith(str(organization_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: file does not belong to your organization"
            )

        status_info = await cloud_sync_service.get_sync_status(
            organization_id=organization_id,
            file_path=file_path
        )

        return SyncStatusResponse(**status_info)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status check failed: {str(e)}"
        )


@router.get("/list/{module}")
async def list_files(
    module: str,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    List files for a specific module and organization.
    Validates that the files belong to the requesting organization.
    """
    try:
        # Generate organization-specific path prefix
        path_prefix = f"{organization_id}/{module}/"
        
        # Determine bucket based on module
        if module == "kits":
            bucket = "public-assets"  # Kit photos are public
        else:
            bucket = "production-files"  # Scripts, PDFs, etc. are private

        # List files from storage service
        files = await storage_service.list_files(bucket, path_prefix)
        
        # Add additional metadata to each file
        enriched_files = []
        for file_obj in files:
            file_name = file_obj.get('name') if isinstance(file_obj, dict) else getattr(file_obj, 'name', None)
            if file_name:
                file_path = f"{path_prefix}{file_name}"
                enriched_files.append({
                    "name": file_name,
                    "path": file_path,
                    "bucket": bucket,
                    "size": file_obj.get('metadata', {}).get('size') if isinstance(file_obj, dict) else getattr(file_obj, 'size', None),
                    "created_at": file_obj.get('metadata', {}).get('created_at') if isinstance(file_obj, dict) else getattr(file_obj, 'created_at', None),
                    "is_public": bucket == "public-assets"
                })

        return enriched_files

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list files: {str(e)}"
        )


@router.delete("/{bucket}/{file_path:path}")
async def delete_file(
    bucket: str,
    file_path: str,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete a file from storage.
    Validates that the file belongs to the requesting organization.
    """
    try:
        # Validate file ownership
        if not file_path.startswith(str(organization_id)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: file does not belong to your organization"
            )

        # Validate bucket
        allowed_buckets = ["public-assets", "production-files"]
        if bucket not in allowed_buckets:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid bucket: {bucket}"
            )

        success = await storage_service.delete_file(bucket, file_path)

        if success:
            return {"message": "File deleted successfully", "file_path": file_path}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="File deletion failed"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File deletion failed: {str(e)}"
        )
