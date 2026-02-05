'use client'

import { useParams, useRouter } from 'next/navigation'
import { useProject, useDeleteProject, useProjectStats } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { ShootingDaysTab } from '@/components/shooting-days/ShootingDaysTab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Trash2, FileText, DollarSign, Film, FolderOpen, Users, Calendar } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { formatCurrency } from '@/lib/utils/money'
import { useState, useEffect } from 'react'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'
import { FileUploadZone, FileList } from '@/components/storage'
import { FileUploadResponse } from '@/types'
import { useTranslations, useLocale } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProjectExpensesTab } from '@/components/projects/ProjectExpensesTab'
import { TeamTab } from '@/components/projects/TeamTab'

export default function ProjectDetailPage() {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const { organizationId, profile } = useAuth()
  const projectId = params.id as string

  // Check if user is admin or owner
  const isAdmin = profile?.effective_role === 'admin' || profile?.effective_role === 'owner' || profile?.is_master_owner === true

  const { data: project, isLoading, error } = useProject(projectId, organizationId || undefined)
  const { data: stats } = useProjectStats(projectId)
  const deleteProject = useDeleteProject(projectId, organizationId || '')

  const { open: deleteOpen, onOpenChange: setDeleteOpen, askConfirmation: confirmDelete, closeConfirmation: cancelDelete } = useConfirmDelete()
  const { errorDialog, showError, closeError } = useErrorDialog()

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
    try {
      await deleteProject.mutateAsync()
      router.push('/projects')
    } catch (err: unknown) {
      cancelDelete()
      showError(err, 'Failed to delete project')
    }
  }

  const requestDelete = () => {
    confirmDelete(projectId)
  }

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error) {
    return <div>{t('errors.loadingProject')}: {error.message}</div>
  }

  if (!project) {
    return <div>{t('errors.projectNotFound')}</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
          <p className="text-muted-foreground">
            {t('details.created')} {new Date(project.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <LocaleLink href={`/projects/${projectId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              {t('details.edit')}
            </LocaleLink>
          </Button>
          <Button
            variant="destructive"
            onClick={requestDelete}
            disabled={deleteProject.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('details.delete')}
          </Button>
        </div>
      </div>



      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{project.status.replace(/-/g, ' ')}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('budget')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t('details.production.scenes')}</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.scenes_count || 0}</div>
            <p className="text-xs text-muted-foreground">{t('details.inScript')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="flex flex-wrap sm:inline-flex w-full sm:w-auto !h-auto gap-1 p-1.5 mb-3">
          <TabsTrigger value="details" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.details')}</TabsTrigger>
          <TabsTrigger value="shooting-days" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.shootingDays')}</TabsTrigger>
          <TabsTrigger value="team" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.team.title')}</TabsTrigger>
          <TabsTrigger value="financials" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.financials')}</TabsTrigger>
          <TabsTrigger value="production" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.production')}</TabsTrigger>
          <TabsTrigger value="files" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.files')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('details.projectInformation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('status')}</div>
                  <div className="text-lg">{project.status.replace(/-/g, ' ')}</div>
                </div>
                {project.start_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">{t('startDate')}</div>
                    <div className="text-lg">{new Date(project.start_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">{t('endDate')}</div>
                    <div className="text-lg">{new Date(project.end_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                )}
              </div>

              {project.client && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">{t('client')}</div>
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

        <TabsContent value="team">
          <TeamTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="financials">
          <ProjectExpensesTab projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="production">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Scenes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5" />
                    {t('details.production.scenes')}
                  </CardTitle>
                  <CardDescription>
                    {t('details.production.scenesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button asChild variant="outline" className="w-full justify-start">
                      <LocaleLink href={`/scenes?project=${projectId}`}>
                        {t('details.production.viewAllScenes')}
                      </LocaleLink>
                    </Button>
                    <Button asChild className="w-full justify-start">
                      <LocaleLink href={`/scenes/new?project=${projectId}`}>
                        {t('details.production.createNewScene')}
                      </LocaleLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Characters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('details.production.characters')}
                  </CardTitle>
                  <CardDescription>
                    {t('details.production.charactersDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button asChild variant="outline" className="w-full justify-start">
                      <LocaleLink href={`/characters?project=${projectId}`}>
                        {t('details.production.viewAllCharacters')}
                      </LocaleLink>
                    </Button>
                    <Button asChild className="w-full justify-start">
                      <LocaleLink href={`/characters/new?project=${projectId}`}>
                        {t('details.production.createNewCharacter')}
                      </LocaleLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Shooting Days */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t('details.production.shootingDays')}
                  </CardTitle>
                  <CardDescription>
                    {t('details.production.shootingDaysDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button asChild variant="outline" className="w-full justify-start">
                      <LocaleLink href={`/shooting-days?project=${projectId}`}>
                        {t('details.production.viewAllShootingDays')}
                      </LocaleLink>
                    </Button>
                    <Button asChild className="w-full justify-start">
                      <LocaleLink href={`/shooting-days/new?project=${projectId}`}>
                        {t('details.production.scheduleNewDay')}
                      </LocaleLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Production Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t('details.production.summary')}</CardTitle>
                <CardDescription>
                  {t('details.production.summaryDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats?.scenes_count || 0}</div>
                    <div className="text-sm text-muted-foreground">{t('details.production.scenesCreated')}</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats?.characters_count || 0}</div>
                    <div className="text-sm text-muted-foreground">{t('details.production.charactersDefined')}</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats?.shooting_days_count || 0}</div>
                    <div className="text-sm text-muted-foreground">{t('details.production.shootingDaysCount')}</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats?.team_count || 0}</div>
                    <div className="text-sm text-muted-foreground">{t('details.team.title')}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {t('details.production.getStartedMessage')}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t('details.files.scripts')}</CardTitle>
              </div>
              <CardDescription>
                {t('details.files.scriptsDescription')}
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
                <CardTitle>{t('details.files.callSheetsDocuments')}</CardTitle>
              </div>
              <CardDescription>
                {t('details.files.callSheetsDescription')}
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
                <CardTitle>{t('details.files.mediaFiles')}</CardTitle>
              </div>
              <CardDescription>
                {t('details.files.mediaDescription')}
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={tCommon('delete')}
        description={t('details.deleteConfirm')}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        loading={deleteProject.isPending}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => !open && closeError()}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
      />
    </div>
  )
}
