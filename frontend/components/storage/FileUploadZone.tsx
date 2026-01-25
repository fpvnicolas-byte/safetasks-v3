'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileIcon, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUploadFile } from '@/lib/api/hooks'
import { FileUploadResponse } from '@/types'
import { cn } from '@/lib/utils'

interface FileUploadZoneProps {
  module: string // kits, scripts, call-sheets, proposals
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
}

export function FileUploadZone({
  module,
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
  const uploadFile = useUploadFile()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Add files to uploading state
      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        file,
        status: 'uploading' as const,
      }))
      setUploadingFiles((prev) => [...prev, ...newFiles])

      // Upload each file
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]

        try {
          const result = await uploadFile.mutateAsync({ file, module })

          // Update file status to success
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? { ...f, status: 'success' as const, filePath: result.file_path }
                : f
            )
          )

          // Notify parent with full result
          if (onUploadComplete) {
            onUploadComplete(result)
          }

          // Remove from list after 2 seconds
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
          }, 2000)
        } catch (error) {
          // Update file status to error
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
    [module, uploadFile, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize: maxSize * 1024 * 1024, // Convert MB to bytes
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
                ? 'Drop files here'
                : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxSize}MB
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
                          ? `File too large (max ${maxSize}MB)`
                          : error.code === 'file-invalid-type'
                          ? 'Invalid file type'
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
          {uploadingFiles.map(({ file, status, error }) => (
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploading...
                      </p>
                    </div>
                  )}
                  {status === 'error' && (
                    <p className="text-xs text-destructive mt-1">{error}</p>
                  )}
                  {status === 'success' && (
                    <p className="text-xs text-green-600 mt-1">
                      Upload complete!
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
