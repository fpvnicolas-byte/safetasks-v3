'use client'

import { useState } from 'react'
import { Grid, List } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileItem } from './FileItem'
import { FileUploadResponse } from '@/types'
import { cn } from '@/lib/utils'

interface FileListProps {
  files: FileUploadResponse[]
  onFileDeleted?: (filePath: string) => void
  showSyncStatus?: boolean
  syncStatuses?: Record<string, 'synced' | 'syncing' | 'failed' | 'not_synced'>
  className?: string
}

type ViewMode = 'grid' | 'list'

export function FileList({
  files,
  onFileDeleted,
  showSyncStatus = false,
  syncStatuses = {},
  className,
}: FileListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  if (files.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-muted-foreground">No files uploaded yet</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </p>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-[160px] grid-cols-2">
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-2">
              <Grid className="h-4 w-4" />
              Grid
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* File Items */}
      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
        )}
      >
        {files.map((file) => (
          <FileItem
            key={file.file_path}
            file={file}
            onDelete={() => onFileDeleted?.(file.file_path)}
            showSyncStatus={showSyncStatus}
            syncStatus={syncStatuses[file.file_path]}
          />
        ))}
      </div>
    </div>
  )
}
