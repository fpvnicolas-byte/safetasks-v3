from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_organization_from_profile,
    require_owner_admin_or_producer,
    require_read_only,
    require_billing_active,
    get_current_profile,
    get_organization_record,
)
from app.db.session import get_db
from app.services.storage import storage_service
from app.services.entitlements import ensure_storage_capacity, increment_storage_usage, decrement_storage_usage
from app.schemas.storage import (
    FileUploadResponse, SignedUrlRequest, SignedUrlResponse,
)

router = APIRouter()


@router.post(
    "/upload",
    response_model=FileUploadResponse,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def upload_file(
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    module: str = Form(..., description="Module name: kits, scripts, shooting-days, proposals"),
    entity_id: Optional[str] = Form(None, description="Optional entity ID for sub-folder organization (e.g., proposal_id)"),
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

        organization = await get_organization_record(profile, db)
        await ensure_storage_capacity(db, organization, bytes_to_add=len(file_content))

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
            bucket=bucket,
            entity_id=entity_id
        )

        await increment_storage_usage(db, organization_id, bytes_added=len(file_content))
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


@router.post("/sign-url", response_model=SignedUrlResponse, dependencies=[Depends(require_read_only)])
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


@router.get("/list/{module}", dependencies=[Depends(require_read_only)])
async def list_files(
    module: str,
    entity_id: Optional[str] = None,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    List files for a specific module and organization.
    Optionally filter by entity_id (e.g., proposal_id).
    Validates that the files belong to the requesting organization.
    """
    try:
        # Generate organization-specific path prefix (with optional entity_id)
        if entity_id:
            path_prefix = f"{organization_id}/{module}/{entity_id}/"
        else:
            path_prefix = f"{organization_id}/{module}/"

        # Determine bucket based on module
        if module == "kits":
            bucket = "public-assets"  # Kit photos are public
        else:
            bucket = "production-files"  # Scripts, PDFs, etc. are private

        enriched_files = []

        # 1. Fetch from Supabase Storage
        try:
            files = await storage_service.list_files(bucket, path_prefix)
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
        except Exception:
            # Fallback if Supabase fails (or folder doesn't exist)
            pass

        # 2. Fetch from Google Drive (CloudFileReference)
        from sqlalchemy import select
        from app.models.cloud import CloudFileReference
        
        query = select(CloudFileReference).where(
            CloudFileReference.organization_id == organization_id,
            CloudFileReference.module == module
        )
        
        if entity_id:
            try:
                # If entity_id is a UUID, assume it's project_id for now
                uid = UUID(entity_id)
                query = query.where(CloudFileReference.project_id == uid)
            except ValueError:
                pass

        result = await db.execute(query)
        drive_files = result.scalars().all()

        for df in drive_files:
             enriched_files.append({
                 "name": df.file_name,
                 "path": str(df.id), # Use Reference ID as path
                 "bucket": "google_drive",
                 "size": int(df.file_size) if df.file_size and df.file_size.isdigit() else 0,
                 "created_at": df.created_at.isoformat() if df.created_at else None,
                 "is_public": False,
                 "access_url": df.external_url
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


@router.delete(
    "/{bucket}/{file_path:path}",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
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
        # Handle Google Drive file deletion
        if bucket == "google_drive":
            from sqlalchemy import select
            from app.models.cloud import CloudFileReference

            try:
                ref_id = UUID(file_path)
            except ValueError:
                 raise HTTPException(status_code=400, detail="Invalid file ID for Google Drive file")

            result = await db.execute(select(CloudFileReference).where(CloudFileReference.id == ref_id))
            file_ref = result.scalar_one_or_none()

            if not file_ref:
                raise HTTPException(status_code=404, detail="File not found")

            if file_ref.organization_id != organization_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Delete the actual file from Google Drive
            if file_ref.external_id:
                from app.services.google_drive import google_drive_service
                await google_drive_service.delete_file(
                    organization_id=organization_id,
                    drive_file_id=file_ref.external_id,
                    db=db,
                )

            # Delete the DB reference
            await db.delete(file_ref)
            await db.commit()
            
            return {"message": "File deleted successfully", "file_path": file_path}

        # Validate file ownership for Supabase files
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

        file_size = await storage_service.get_file_size(bucket, file_path)
        success = await storage_service.delete_file(bucket, file_path)

        if success:
            if file_size:
                await decrement_storage_usage(db, organization_id, bytes_removed=file_size)
            return {"message": "File deleted successfully", "file_path": file_path}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="File deletion failed"
            )

    except HTTPException:
        raise
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
