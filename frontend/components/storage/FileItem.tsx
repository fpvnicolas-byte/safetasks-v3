'use client'

import { useState } from 'react'
import {
  FileIcon,
  FileText,
  ImageIcon,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useDeleteFile, useSignedUrl } from '@/lib/api/hooks'
import { FileUploadResponse } from '@/types'
import { cn } from '@/lib/utils'

interface FileItemProps {
  file: FileUploadResponse
  onDelete?: () => void
  showSyncStatus?: boolean
  syncStatus?: 'synced' | 'syncing' | 'failed' | 'not_synced'
  className?: string
}

export function FileItem({
  file,
  onDelete,
  showSyncStatus = false,
  syncStatus = 'not_synced',
  className,
}: FileItemProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteFile = useDeleteFile()
  const getSignedUrl = useSignedUrl()

  // Extract filename from path
  const fileName = file.file_path.split('/').pop() || 'Unknown file'

  // Get file extension
  const extension = fileName.split('.').pop()?.toLowerCase() || ''

  // Determine file type icon
  const getFileIcon = () => {
    if (file.content_type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5" />
    }
    if (file.content_type === 'application/pdf') {
      return <FileText className="h-5 w-5" />
    }
    return <FileIcon className="h-5 w-5" />
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Handle download
  const handleDownload = async () => {
    try {
      let url = file.access_url

      // If file is private, get signed URL
      if (!file.is_public && !url) {
        const result = await getSignedUrl.mutateAsync({
          bucket: file.bucket,
          file_path: file.file_path,
          expires_in: 3600,
        })
        url = result.signed_url
      }

      if (url) {
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await deleteFile.mutateAsync({
        bucket: file.bucket,
        filePath: file.file_path,
      })
      onDelete?.()
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Get sync status badge
  const getSyncBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Synced
          </Badge>
        )
      case 'syncing':
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="gap-1 text-destructive border-destructive">
            <XCircle className="h-3 w-3" />
            Sync failed
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start gap-4">
        {/* File Icon */}
        <div className="flex-shrink-0 text-muted-foreground mt-1">
          {getFileIcon()}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{fileName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">
                  {formatSize(file.size_bytes)}
                </span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground uppercase">
                  {extension}
                </span>
                {file.is_public && (
                  <>
                    <span className="text-sm text-muted-foreground">•</span>
                    <Badge variant="secondary" className="text-xs">
                      Public
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sync Status */}
          {showSyncStatus && (
            <div className="mt-2">
              {getSyncBadge()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Download Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={getSignedUrl.isPending}
            className="h-8 w-8 p-0"
            title="Download"
          >
            {getSignedUrl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>

          {/* View Button (for public files) */}
          {file.is_public && file.access_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(file.access_url!, '_blank')}
              className="h-8 w-8 p-0"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}

          {/* Delete Button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Delete"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete file?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &ldquo;{fileName}&rdquo;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Card>
  )
}
