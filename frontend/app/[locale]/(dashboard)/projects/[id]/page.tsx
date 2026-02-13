'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useProject, useDeleteProject, useProjectStats } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useFiles } from '@/lib/api/hooks/useFiles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Trash2, FileText, DollarSign, Film, FolderOpen, Users, Calendar, Loader2 } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { formatCurrency } from '@/lib/utils/money'
import { useState, useEffect } from 'react'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'
import { FileUploadResponse } from '@/types'
import { useTranslations, useLocale } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Skeleton } from '@/components/ui/skeleton'

function TabPanelFallback() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

const ShootingDaysTab = dynamic(
  () => import('@/components/shooting-days/ShootingDaysTab').then((mod) => mod.ShootingDaysTab),
  { loading: TabPanelFallback }
)
const FileUploadZone = dynamic(
  () => import('@/components/storage').then((mod) => mod.FileUploadZone),
  { loading: TabPanelFallback }
)
const FileList = dynamic(
  () => import('@/components/storage').then((mod) => mod.FileList),
  { loading: TabPanelFallback }
)
const ProjectExpensesTab = dynamic(
  () => import('@/components/projects/ProjectExpensesTab').then((mod) => mod.ProjectExpensesTab),
  { loading: TabPanelFallback }
)
const TeamTab = dynamic(
  () => import('@/components/projects/TeamTab').then((mod) => mod.TeamTab),
  { loading: TabPanelFallback }
)
const ProjectAssignmentsCard = dynamic(
  () => import('@/components/projects/ProjectAssignmentsCard').then((mod) => mod.ProjectAssignmentsCard),
  { loading: TabPanelFallback }
)

export default function ProjectDetailPage() {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const { organizationId, profile } = useAuth()
  const projectId = params.id as string

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const isFreelancer = effectiveRole === 'freelancer'
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'
  const canViewFinancials =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer' ||
    effectiveRole === 'finance'

  const { data: project, isLoading, error } = useProject(projectId, organizationId || undefined)
  const { data: stats } = useProjectStats(projectId)
  const deleteProject = useDeleteProject(projectId, organizationId || '')

  const { open: deleteOpen, onOpenChange: setDeleteOpen, askConfirmation: confirmDelete, closeConfirmation: cancelDelete } = useConfirmDelete()
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Separate state for each file type
  const [scripts, setScripts] = useState<FileUploadResponse[]>([])
  const [shootingDayFiles, setShootingDayFiles] = useState<FileUploadResponse[]>([])
  const [media, setMedia] = useState<FileUploadResponse[]>([])
  const [activeTab, setActiveTab] = useState('details')

  const shouldLoadFiles = !isFreelancer && activeTab === 'files'

  // File persistence hooks
  const { data: scriptFiles = [] } = useFiles(shouldLoadFiles ? 'scripts' : '', organizationId || undefined)
  const { data: shootingDayFilesData = [] } = useFiles(shouldLoadFiles ? 'shooting-days' : '', organizationId || undefined)
  const { data: mediaFiles = [] } = useFiles(shouldLoadFiles ? 'media' : '', organizationId || undefined)

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

  // Initialize shooting day files with existing files
  useEffect(() => {
    if (shootingDayFilesData.length > 0) {
      const converted: FileUploadResponse[] = shootingDayFilesData.map(file => ({
        file_path: file.path,
        bucket: file.bucket,
        access_url: file.is_public
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket}/${file.path}`
          : null,
        is_public: file.is_public,
        size_bytes: file.size || 0,
        content_type: 'application/pdf',
      }))
      setShootingDayFiles(converted)
    }
  }, [shootingDayFilesData])

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

  // Handle upload complete for shooting days
  const handleShootingDayUploadComplete = (result: FileUploadResponse) => {
    setShootingDayFiles((prev) => [...prev, result])
  }

  // Handle upload complete for media
  const handleMediaUploadComplete = (result: FileUploadResponse) => {
    setMedia((prev) => [...prev, result])
  }

  // Handle file deletion
  const handleScriptDeleted = (filePath: string) => {
    setScripts((prev) => prev.filter((f) => f.file_path !== filePath))
  }

  const handleShootingDayDeleted = (filePath: string) => {
    setShootingDayFiles((prev) => prev.filter((f) => f.file_path !== filePath))
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
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('details.projectInformation')}</h1>
            <p className="text-muted-foreground">{t('errors.loadingProject')}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <DetailPageSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('details.projectInformation')}</h1>
          <p className="text-muted-foreground">{t('errors.loadingProject')}</p>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            {t('errors.loadingProject')}: {error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('details.projectInformation')}</h1>
          <p className="text-muted-foreground">{t('errors.projectNotFound')}</p>
        </div>
      </div>
    )
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
        {canManage && (
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
        )}
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

        {canViewFinancials && !isFreelancer && (
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
        )}



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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap sm:inline-flex w-full sm:w-auto !h-auto gap-1 p-1.5 mb-3">
          <TabsTrigger value="details" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.details')}</TabsTrigger>
          <TabsTrigger value="shooting-days" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.shootingDays')}</TabsTrigger>
          {canManage && (
            <TabsTrigger value="team" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.team.title')}</TabsTrigger>
          )}
          {canViewFinancials && !isFreelancer && (
            <TabsTrigger value="financials" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.financials')}</TabsTrigger>
          )}
          <TabsTrigger value="production" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.production')}</TabsTrigger>
          {!isFreelancer && (
            <TabsTrigger value="files" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[30%] sm:min-w-0">{t('details.tabs.files')}</TabsTrigger>
          )}
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

        {canManage && (
          <TabsContent value="team">
            <div className="space-y-6">
              <TeamTab projectId={projectId} />
              <ProjectAssignmentsCard projectId={projectId} />
            </div>
          </TabsContent>
        )}

        {canViewFinancials && !isFreelancer && (
          <TabsContent value="financials">
            <ProjectExpensesTab projectId={projectId} project={project} />
          </TabsContent>
        )}

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
                    {canManage && (
                      <Button asChild className="w-full justify-start">
                        <LocaleLink href={`/scenes/new?project=${projectId}`}>
                          {t('details.production.createNewScene')}
                        </LocaleLink>
                      </Button>
                    )}
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
                    {canManage && (
                      <Button asChild className="w-full justify-start">
                        <LocaleLink href={`/characters/new?project=${projectId}`}>
                          {t('details.production.createNewCharacter')}
                        </LocaleLink>
                      </Button>
                    )}
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
                    {canManage && (
                      <Button asChild className="w-full justify-start">
                        <LocaleLink href={`/shooting-days/new?project=${projectId}`}>
                          {t('details.production.scheduleNewDay')}
                        </LocaleLink>
                      </Button>
                    )}
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

        {!isFreelancer && (
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
                  projectId={projectId}
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
                  <CardTitle>{t('details.files.shootingDaysDocuments')}</CardTitle>
                </div>
                <CardDescription>
                  {t('details.files.shootingDaysDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadZone
                  module="shooting-days"
                  projectId={projectId}
                  accept={{
                    'application/pdf': ['.pdf'],
                    'application/msword': ['.doc'],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  }}
                  maxSize={25}
                  onUploadComplete={handleShootingDayUploadComplete}
                />

                {shootingDayFiles.length > 0 && (
                  <div className="pt-4">
                    <FileList
                      files={shootingDayFiles}
                      onFileDeleted={handleShootingDayDeleted}
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
                  projectId={projectId}
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
        )}
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
