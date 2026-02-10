'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileIcon, X, CheckCircle2, AlertCircle, Cloud } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useUploadFile } from '@/lib/api/hooks'
import {
  useGoogleDriveStatus,
  useCreateDriveUploadSession,
  useConfirmDriveUpload
} from '@/lib/api/hooks/useGoogleDrive'
import { FileUploadResponse } from '@/types'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface FileUploadZoneProps {
  module: string // kits, scripts, shooting-days, proposals, media
  entityId?: string // Optional entity ID (e.g., proposalId or projectId)
  projectId?: string // Explicit Project ID for Google Drive uploads
  accept?: Record<string, string[]>
  maxSize?: number // In MB
  multiple?: boolean
  onUploadComplete?: (result: FileUploadResponse) => void
  className?: string
}

interface UploadingFile {
  file: File
  status: 'uploading' | 'success' | 'error'
  error?: string
  filePath?: string
  storage?: 'supabase' | 'google_drive'
}

export function FileUploadZone({
  module,
  entityId,
  projectId,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  },
  maxSize = 10, // 10MB default
  multiple = true,
  onUploadComplete,
  className,
}: FileUploadZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [useGoogleDrive, setUseGoogleDrive] = useState(false)

  const uploadFile = useUploadFile()
  const { data: driveStatus } = useGoogleDriveStatus()
  const createDriveSession = useCreateDriveUploadSession()
  const confirmDriveUpload = useConfirmDriveUpload()

  const t = useTranslations('storage.fileUpload')

  const isDriveAvailable = driveStatus?.connected && !!projectId

  // When Google Drive is active, allow up to 10GB; otherwise use the prop limit
  const DRIVE_MAX_SIZE_MB = 10240 // 10GB in MB
  const effectiveMaxSize = (useGoogleDrive && isDriveAvailable) ? DRIVE_MAX_SIZE_MB : maxSize

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Add files to uploading state
      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        file,
        status: 'uploading' as const,
        storage: (useGoogleDrive && isDriveAvailable) ? 'google_drive' : 'supabase'
      }))
      setUploadingFiles((prev) => [...prev, ...newFiles])

      // Upload each file
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const isDriveUpload = useGoogleDrive && isDriveAvailable

        try {
          let result: FileUploadResponse

          if (isDriveUpload && projectId) {
            // ── Google Drive Upload ──

            // 1. Create resumable session
            const session = await createDriveSession.mutateAsync({
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
              project_id: projectId,
              module: module,
            })

            // 2. Upload to Google (PUT)
            await fetch(session.session_uri, {
              method: 'PUT',
              headers: {
                'Content-Type': file.type,
              },
              body: file,
            })

            // 3. Confirm & Get Metadata
            // Note: Google doesn't return the file ID in the PUT response body reliably across all CORS modes,
            // but our backend pre-created a CloudFileReference. We just need to confirm it.
            // Wait - our confirm endpoint needs the drive_file_id.
            // Google Resumable Upload response DOES contain the file resource JSON if successful.
            // We need to capture the response from the fetch/PUT.

            // Re-do fetch to capture response
            /*
            const uploadResponse = await fetch(...)
            const uploadData = await uploadResponse.json()
            const driveFileId = uploadData.id
            */

            // Let's implement the fetch properly
            const uploadResponse = await fetch(session.session_uri, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
            })

            if (!uploadResponse.ok) {
              throw new Error(`Google Drive upload failed: ${uploadResponse.statusText}`)
            }

            const uploadData = await uploadResponse.json()
            const driveFileId = uploadData.id
            // drive_file_url is usually implicit or webViewLink
            const driveFileUrl = uploadData.webViewLink

            const confirmResult = await confirmDriveUpload.mutateAsync({
              file_reference_id: session.file_reference_id,
              drive_file_id: driveFileId,
              drive_file_url: driveFileUrl,
            })

            // Map to FileUploadResponse
            result = {
              file_path: confirmResult.id, // Use our internal ID (CloudFileReference ID)
              bucket: 'google_drive',
              access_url: confirmResult.external_url || null,
              is_public: false,
              size_bytes: file.size,
              content_type: file.type,
            }

          } else {
            // ── Supabase Upload ──
            result = await uploadFile.mutateAsync({ file, module, entityId })
          }

          // Update file status to success
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? { ...f, status: 'success' as const, filePath: result.file_path }
                : f
            )
          )

          // Notify parent
          if (onUploadComplete) {
            onUploadComplete(result)
          }

          // Remove from list
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
          }, 2000)

        } catch (error) {
          console.error(error)
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
                : f
            )
          )
        }
      }
    },
    [module, entityId, projectId, useGoogleDrive, isDriveAvailable, uploadFile, createDriveSession, confirmDriveUpload, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize: effectiveMaxSize * 1024 * 1024,
      multiple,
    })

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className={className}>
      {/* Drive Toggle */}
      {isDriveAvailable && (
        <div className="mb-4 flex items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
          <div className="flex items-center gap-2">
            <Cloud className={cn("h-5 w-5", useGoogleDrive ? "text-blue-500" : "text-muted-foreground")} />
            <div className="grid gap-0.5">
              <Label htmlFor="drive-mode" className="text-sm font-medium">
                {t('storageDrive')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('storageDriveDesc', { email: driveStatus?.connected_email || 'Drive' })}
              </p>
            </div>
          </div>
          <Switch
            id="drive-mode"
            checked={useGoogleDrive}
            onCheckedChange={setUseGoogleDrive}
          />
        </div>
      )}

      {/* Drop Zone */}
      <Card
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <div className="p-8 text-center">
          <input {...getInputProps()} />
          <Upload
            className={cn(
              'mx-auto h-12 w-12 mb-4',
              isDragActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive
                ? t('dragActive')
                : t('dragInactive')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('clickToBrowse')}
            </p>
            <p className="text-xs text-muted-foreground">
              {(useGoogleDrive && isDriveAvailable)
                ? t('googleDriveNoLimit')
                : t('maxSize', { size: maxSize })}
            </p>
          </div>
        </div>
      </Card>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="mt-4 space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <Card key={file.name} className="p-3 border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <ul className="text-xs text-muted-foreground mt-1">
                    {errors.map((error) => (
                      <li key={error.code}>
                        {error.code === 'file-too-large'
                          ? t('fileTooLarge', { size: effectiveMaxSize })
                          : error.code === 'file-invalid-type'
                            ? t('invalidFileType')
                            : error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map(({ file, status, error, storage }) => (
            <Card key={file.name} className="p-3">
              <div className="flex items-center gap-3">
                <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  {status === 'uploading' && (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {storage === 'google_drive' ? (
                          <>
                            <Cloud className="h-3 w-3 inline" /> {t('uploadingDrive')}
                          </>
                        ) : (
                          t('uploading')
                        )}
                      </p>
                    </div>
                  )}
                  {status === 'error' && (
                    <p className="text-xs text-destructive mt-1">{error}</p>
                  )}
                  {status === 'success' && (
                    <p className="text-xs text-green-600 mt-1">
                      {t('uploadComplete')}
                    </p>
                  )}
                </div>
                {status === 'uploading' && (
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {status === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
                {status === 'error' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
