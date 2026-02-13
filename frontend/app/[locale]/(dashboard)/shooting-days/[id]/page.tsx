'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useShootingDay, useDeleteShootingDay, useScenes, useAssignScenesToShootingDay, useAddCrewMember, useRemoveCrewMember, useUpdateCrewMember, useUnassignScenes, useTeamMembers } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft, Calendar, Clock, MapPin, CloudSun, FileText, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { convertTimeToFormFormat } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { toast } from 'sonner'

function AssignmentsFallback() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

const ShootingDayAssignmentsSection = dynamic(
  () => import('@/components/shooting-days/ShootingDayDetailAssignments').then((mod) => mod.ShootingDayAssignmentsSection),
  { loading: AssignmentsFallback }
)

export default function ShootingDayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const { organizationId, profile } = useAuth()
  const shootingDayId = params.id as string
  const t = useTranslations('shootingDays.detail')
  const tCommon = useTranslations('common')

  const [selectedScenes, setSelectedScenes] = useState<string[]>([])
  const [assignmentMessage, setAssignmentMessage] = useState<string>('')
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [productionFunction, setProductionFunction] = useState<string>('')
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null)
  const [editingFunction, setEditingFunction] = useState<string>('')

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  const { data: shootingDay, isLoading, error } = useShootingDay(shootingDayId)
  const deleteShootingDay = useDeleteShootingDay(organizationId || '')

  // Fetch scenes for the project (once we know the project_id)
  const { data: allScenes } = useScenes(shootingDay?.project_id || '')
  const assignScenes = useAssignScenesToShootingDay(shootingDayId, organizationId || '')
  const unassignScenes = useUnassignScenes(shootingDayId, organizationId || '')

  // Crew management hooks
  const { data: teamMembers } = useTeamMembers(organizationId || undefined)
  const addCrewMember = useAddCrewMember(shootingDayId, organizationId || '')
  const removeCrewMember = useRemoveCrewMember(shootingDayId, organizationId || '')
  const updateCrewMember = useUpdateCrewMember(shootingDayId, organizationId || '')

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfGenerated, setPdfGenerated] = useState(false)

  // PDF Generation Handler
  const handleGeneratePdf = async (regenerate = false) => {
    setIsGeneratingPdf(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const pdfLocale = locale === 'pt-br' ? 'pt-BR' : 'en'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/shooting-days/${shootingDayId}/pdf?regenerate=${regenerate}&locale=${pdfLocale}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || t('pdf.generateFailed'))
      }

      const data = await response.json()
      setPdfGenerated(true)

      if (data.status === 'exists' && !regenerate) {
        toast.success(t('pdf.exists'))
      } else {
        toast.success(t('pdf.generated'))
      }
    } catch (error) {
      console.error('PDF generation failed:', error)

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Cannot connect to server. Please check if backend is running.')
      } else if (error instanceof Error && error.message === 'Not authenticated') {
        toast.error('Please log in again to generate PDF.')
      } else {
        toast.error(error instanceof Error ? error.message : t('pdf.generateFailed'))
      }
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/shooting-days/${shootingDayId}/pdf?download=true`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get PDF URL')
      }

      const data = await response.json()
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      } else if (data.signed_url) {
        window.open(data.signed_url, '_blank')
      }
    } catch (error) {
      console.error('PDF download failed:', error)
      toast.error(t('pdf.downloadFailed'))
    }
  }


  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
  } = useConfirmDelete()

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (error || !shootingDay) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('notFound')}</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    try {
      await deleteShootingDay.mutateAsync(shootingDayId)
      router.push(`/${locale}/shooting-days`)
    } catch (err) {
      console.error('Failed to delete shooting day:', err)
      cancelDelete()
    }
  }

  const requestDelete = () => {
    confirmDelete(shootingDayId)
  }

  const formattedDate = new Date(shootingDay.date).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{formattedDate}</h1>
            <p className="text-muted-foreground">{shootingDay.location_name}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleGeneratePdf(pdfGenerated)}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {pdfGenerated ? t('pdf.regenerate') : t('pdf.generate')}
            </Button>
            {pdfGenerated && (
              <Button variant="secondary" onClick={handleDownloadPdf}>
                <Download className="mr-2 h-4 w-4" />
                {t('pdf.download')}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/${locale}/shooting-days/${shootingDayId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon('edit')}
              </Link>
            </Button>
            <Button variant="destructive" onClick={requestDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {tCommon('delete')}
            </Button>
          </div>
        )}
      </div>

      <Badge variant="outline" className="text-base px-4 py-2">
        <Calendar className="mr-2 h-4 w-4" />
        {new Date(shootingDay.date).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
      </Badge>

      <Card>
        <CardHeader>
          <CardTitle>{t('scheduleDetails')}</CardTitle>
          <CardDescription>{t('scheduleDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('callTime')}</div>
                <div className="text-xl font-semibold">{convertTimeToFormFormat(shootingDay.call_time)}</div>
              </div>
            </div>

            {shootingDay.wrap_time && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('wrapTime')}</div>
                  <div className="text-xl font-semibold">{convertTimeToFormFormat(shootingDay.wrap_time)}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('locationInfo')}</CardTitle>
          <CardDescription>{t('locationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-muted-foreground">{t('location')}</div>
              <div className="text-lg font-semibold">{shootingDay.location_name}</div>
              {shootingDay.location_address && (
                <div className="text-sm text-muted-foreground mt-1">{shootingDay.location_address}</div>
              )}
            </div>
          </div>

          {shootingDay.weather_forecast && (
            <div className="flex items-start gap-3">
              <CloudSun className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('weatherForecast')}</div>
                <div className="text-base">{shootingDay.weather_forecast}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {shootingDay.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('productionNotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-base whitespace-pre-wrap flex-1">{shootingDay.notes}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <ShootingDayAssignmentsSection
        canManage={canManage}
        locale={locale}
        projectId={shootingDay.project_id}
        crewAssignments={shootingDay.crew_assignments || []}
        scenes={shootingDay.scenes || []}
        allScenes={allScenes}
        assignmentMessage={assignmentMessage}
        setAssignmentMessage={setAssignmentMessage}
        selectedScenes={selectedScenes}
        setSelectedScenes={setSelectedScenes}
        editingCrewId={editingCrewId}
        setEditingCrewId={setEditingCrewId}
        editingFunction={editingFunction}
        setEditingFunction={setEditingFunction}
        isAddCrewOpen={isAddCrewOpen}
        setIsAddCrewOpen={setIsAddCrewOpen}
        selectedProfileId={selectedProfileId}
        setSelectedProfileId={setSelectedProfileId}
        productionFunction={productionFunction}
        setProductionFunction={setProductionFunction}
        teamMembers={teamMembers}
        assignScenes={assignScenes}
        unassignScenes={unassignScenes}
        addCrewMember={addCrewMember}
        removeCrewMember={removeCrewMember}
        updateCrewMember={updateCrewMember}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={t('deleteConfirm')}
        loading={deleteShootingDay.isPending}
      />
    </div >
  )
}
