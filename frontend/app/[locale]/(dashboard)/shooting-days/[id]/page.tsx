'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useShootingDay, useDeleteShootingDay, useScenes, useAssignScenesToShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Trash2, ArrowLeft, Calendar, Clock, MapPin, CloudSun, FileText, Film } from 'lucide-react'
import Link from 'next/link'
import { convertTimeToFormFormat } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'

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

      <Card>
        <CardHeader>
          <CardTitle>{t('sceneAssignment')}</CardTitle>
          <CardDescription>{t('sceneAssignmentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignmentMessage && (
            <Alert>
              <AlertDescription>{assignmentMessage}</AlertDescription>
            </Alert>
          )}

          {allScenes && allScenes.length > 0 ? (
            canManage ? (
              <>
                <div className="space-y-2">
                  {allScenes.map((scene) => {
                    const isAssigned = scene.shooting_day_id === shootingDayId
                    const isSelected = selectedScenes.includes(scene.id)

                    return (
                      <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Checkbox
                          id={`scene-${scene.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedScenes([...selectedScenes, scene.id])
                            } else {
                              setSelectedScenes(selectedScenes.filter(id => id !== scene.id))
                            }
                          }}
                        />
                        <label htmlFor={`scene-${scene.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t('scene')} {scene.scene_number}</span>
                            {isAssigned && (
                              <Badge variant="secondary" className="text-xs">{t('currentlyAssigned')}</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {scene.heading}
                          </div>
                        </label>
                      </div>
                    )
                  })}
                </div>

                <Button
                  onClick={async () => {
                    try {
                      setAssignmentMessage('')
                      await assignScenes.mutateAsync(selectedScenes)
                      setAssignmentMessage(t('assignSuccess', { count: selectedScenes.length }))
                      setSelectedScenes([])
                    } catch (err: unknown) {
                      const error = err as Error
                      setAssignmentMessage(t('assignError', { message: error.message }))
                    }
                  }}
                  disabled={selectedScenes.length === 0 || assignScenes.isPending}
                >
                  <Film className="mr-2 h-4 w-4" />
                  {assignScenes.isPending ? t('assigning') : t('assignScenes', { count: selectedScenes.length })}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {allScenes.filter((scene) => scene.shooting_day_id === shootingDayId).length > 0 ? (
                  allScenes
                    .filter((scene) => scene.shooting_day_id === shootingDayId)
                    .map((scene) => (
                      <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="mt-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {t('scene')} {scene.scene_number}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{scene.heading}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{scene.description}</div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-muted-foreground">{t('noScenesAssigned')}</div>
                )}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              {t('noScenes')}
              {canManage && (
                <>
                  {' '}
                  <Link href={`/${locale}/scenes/new?project=${shootingDay.project_id}`} className="text-primary hover:underline">
                    {t('createScene')}
                  </Link>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
