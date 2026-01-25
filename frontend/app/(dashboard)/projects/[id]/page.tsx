'use client'

import { useParams, useRouter } from 'next/navigation'
import { useProject, useDeleteProject } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { CallSheetsTab } from '@/components/call-sheets/CallSheetsTab'
import { ShootingDaysTab } from '@/components/shooting-days/ShootingDaysTab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Trash2, FileText, DollarSign, Film, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'
import { FileUploadZone, FileList } from '@/components/storage'
import { FileUploadResponse } from '@/types'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const projectId = params.id as string

  const { data: project, isLoading, error } = useProject(projectId, organizationId || undefined)
  const deleteProject = useDeleteProject(projectId)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Separate state for each file type
  const [scripts, setScripts] = useState<FileUploadResponse[]>([])
  const [callSheets, setCallSheets] = useState<FileUploadResponse[]>([])
  const [media, setMedia] = useState<FileUploadResponse[]>([])

  // File persistence hooks
  const { data: scriptFiles = [] } = useFiles('scripts', organizationId || undefined)
  const { data: callSheetFiles = [] } = useFiles('call-sheets', organizationId || undefined)
  const { data: mediaFiles = [] } = useFiles('media', organizationId || undefined)

  // Initialize scripts with existing files
  useEffect(() => {
    if (scriptFiles.length > 0) {
      const converted: FileUploadResponse[] = scriptFiles.map(file => ({
        file_path: file.path,
        bucket: file.bucket,
        access_url: file.is_public
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}`
          : null,
        is_public: file.is_public,
        size_bytes: file.size || 0,
        content_type: 'application/pdf',
      }))
      setScripts(converted)
    }
  }, [scriptFiles])

  // Initialize call sheets with existing files
  useEffect(() => {
    if (callSheetFiles.length > 0) {
      const converted: FileUploadResponse[] = callSheetFiles.map(file => ({
        file_path: file.path,
        bucket: file.bucket,
        access_url: file.is_public
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}`
          : null,
        is_public: file.is_public,
        size_bytes: file.size || 0,
        content_type: 'application/pdf',
      }))
      setCallSheets(converted)
    }
  }, [callSheetFiles])

  // Initialize media with existing files
  useEffect(() => {
    if (mediaFiles.length > 0) {
      const converted: FileUploadResponse[] = mediaFiles.map(file => ({
        file_path: file.path,
        bucket: file.bucket,
        access_url: file.is_public
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}`
          : null,
        is_public: file.is_public,
        size_bytes: file.size || 0,
        content_type: 'image/*',
      }))
      setMedia(converted)
    }
  }, [mediaFiles])

  // Handle upload complete for scripts
  const handleScriptUploadComplete = (result: FileUploadResponse) => {
    setScripts((prev) => [...prev, result])
  }

  // Handle upload complete for call sheets
  const handleCallSheetUploadComplete = (result: FileUploadResponse) => {
    setCallSheets((prev) => [...prev, result])
  }

  // Handle upload complete for media
  const handleMediaUploadComplete = (result: FileUploadResponse) => {
    setMedia((prev) => [...prev, result])
  }

  // Handle file deletion
  const handleScriptDeleted = (filePath: string) => {
    setScripts((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  const handleCallSheetDeleted = (filePath: string) => {
    setCallSheets((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  const handleMediaDeleted = (filePath: string) => {
    setMedia((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    try {
      await deleteProject.mutateAsync()
      router.push('/projects')
    } catch (err: unknown) {
      const error = err as Error
      setDeleteError(error.message || 'Failed to delete project')
    }
  }

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error) {
    return <div>Error loading project: {error.message}</div>
  }

  if (!project) {
    return <div>Project not found</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
          <p className="text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProject.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{project.status.replace(/-/g, ' ')}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(project.budget_total_cents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Sheets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scenes</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">In script</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="call-sheets">Call Sheets</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <div className="text-lg">{project.status.replace(/-/g, ' ')}</div>
                </div>
                {project.start_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Start Date</div>
                    <div className="text-lg">{new Date(project.start_date).toLocaleDateString()}</div>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">End Date</div>
                    <div className="text-lg">{new Date(project.end_date).toLocaleDateString()}</div>
                  </div>
                )}
              </div>

              {project.client && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Client</div>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-lg font-medium">{project.client.name}</div>
                      {project.client.email && (
                        <div className="text-sm text-muted-foreground">{project.client.email}</div>
                      )}
                      {project.client.phone && (
                        <div className="text-sm text-muted-foreground">{project.client.phone}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shooting-days">
          <ShootingDaysTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="call-sheets">
          <CallSheetsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle>Budget Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Budget</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(project.budget_total_cents)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="text-lg font-bold">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(project.budget_total_cents)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle>Production Details</CardTitle>
              <CardDescription>Scenes, characters, and shooting days</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Production features coming in Phase 7
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Scripts</CardTitle>
              </div>
              <CardDescription>
                Upload script files, drafts, and revisions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadZone
                module="scripts"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'text/plain': ['.txt'],
                }}
                maxSize={25}
                onUploadComplete={handleScriptUploadComplete}
              />

              {scripts.length > 0 && (
                <div className="pt-4">
                  <FileList
                    files={scripts}
                    onFileDeleted={handleScriptDeleted}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Call Sheets & Production Documents</CardTitle>
              </div>
              <CardDescription>
                Upload call sheets, schedules, and production documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadZone
                module="call-sheets"
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                }}
                maxSize={25}
                onUploadComplete={handleCallSheetUploadComplete}
              />

              {callSheets.length > 0 && (
                <div className="pt-4">
                  <FileList
                    files={callSheets}
                    onFileDeleted={handleCallSheetDeleted}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Media Files</CardTitle>
              </div>
              <CardDescription>
                Upload images, videos, and other media assets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadZone
                module="media"
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                  'video/*': ['.mp4', '.mov', '.avi'],
                  'application/pdf': ['.pdf'],
                }}
                maxSize={100}
                onUploadComplete={handleMediaUploadComplete}
              />

              {media.length > 0 && (
                <div className="pt-4">
                  <FileList
                    files={media}
                    onFileDeleted={handleMediaDeleted}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
