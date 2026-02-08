'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useShootingDay, useDeleteShootingDay, useScenes, useAssignScenesToShootingDay, useAddCrewMember, useRemoveCrewMember, useUpdateCrewMember, useUnassignScenes, useTeamMembers } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Trash2, ArrowLeft, Calendar, Clock, MapPin, CloudSun, FileText, Film, Users, X, Phone, Mail, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { convertTimeToFormFormat } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                <Users className="inline mr-2 h-5 w-5" />
                {t('crew')}
              </CardTitle>
              <CardDescription>{t('crewDescription')}</CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setIsAddCrewOpen(true)} size="sm">
                {t('addCrew')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {shootingDay.crew_assignments && shootingDay.crew_assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('name')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('function')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('phone')}</th>
                    <th className="text-left py-2 px-2 text-sm font-medium">{t('email')}</th>
                    {canManage && <th className="text-right py-2 px-2 text-sm font-medium">{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {shootingDay.crew_assignments.map((crew) => (
                    <tr key={crew.id} className="border-b last:border-0">
                      <td className="py-3 px-2">{crew.profile_name || crew.profile_email}</td>
                      <td className="py-3 px-2">
                        {editingCrewId === crew.id ? (
                          <Input
                            value={editingFunction}
                            onChange={(e) => setEditingFunction(e.target.value)}
                            onBlur={async () => {
                              if (editingFunction.trim()) {
                                await updateCrewMember.mutateAsync({
                                  assignmentId: crew.id,
                                  production_function: editingFunction
                                })
                              }
                              setEditingCrewId(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <span
                            className={canManage ? "cursor-pointer hover:text-primary" : ""}
                            onClick={() => {
                              if (canManage) {
                                setEditingCrewId(crew.id)
                                setEditingFunction(crew.production_function)
                              }
                            }}
                          >
                            {crew.production_function}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {crew.profile_phone ? (
                          <a href={`tel:${crew.profile_phone}`} className="flex items-center gap-1 hover:text-primary">
                            <Phone className="h-3 w-3" />
                            {crew.profile_phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        <a href={`mailto:${crew.profile_email}`} className="flex items-center gap-1 hover:text-primary">
                          <Mail className="h-3 w-3" />
                          {crew.profile_email}
                        </a>
                      </td>
                      {canManage && (
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await removeCrewMember.mutateAsync(crew.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noCrewAssigned')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sceneAssignment')}</CardTitle>
          <CardDescription>{t('sceneAssignmentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignmentMessage && (
            <Alert>
              <AlertDescription>{assignmentMessage}</AlertDescription>
            </Alert>
          )}

          {allScenes && allScenes.length > 0 ? (
            <>
              {/* Assigned Scenes Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t('assignedScenes')}</h3>
                {shootingDay.scenes && shootingDay.scenes.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {shootingDay.scenes.map((scene) => (
                        <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {t('scene')} {scene.scene_number}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {scene.internal_external === 'internal' ? t('int') : t('ext')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {scene.day_night === 'day' ? t('day') : scene.day_night === 'night' ? t('night') : scene.day_night}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {scene.estimated_time_minutes} {t('minutes')}
                              </span>
                            </div>
                            <div className="text-sm font-medium">{scene.heading}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{scene.description}</div>
                          </div>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                await unassignScenes.mutateAsync([scene.id])
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {t('totalEstimatedTime')}: {shootingDay.scenes.reduce((sum, scene) => sum + scene.estimated_time_minutes, 0)} {t('minutes')}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noScenesAssigned')}</p>
                )}
              </div>

              {/* Assign New Scenes Section (for managers only) */}
              {canManage && (
                <div className="space-y-3 pt-3 border-t">
                  <h3 className="text-sm font-semibold">{t('assignNewScenes')}</h3>
                  {allScenes.filter(scene => !scene.shooting_day_id).length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {allScenes
                          .filter(scene => !scene.shooting_day_id)
                          .map((scene) => {
                            const isSelected = selectedScenes.includes(scene.id)

                            return (
                              <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
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
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {t('scene')} {scene.scene_number}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {scene.internal_external === 'internal' ? t('int') : t('ext')}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {scene.day_night === 'day' ? t('day') : scene.day_night === 'night' ? t('night') : scene.day_night}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {scene.estimated_time_minutes} {t('minutes')}
                                    </span>
                                  </div>
                                  <div className="text-sm font-medium">{scene.heading}</div>
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
                    <p className="text-sm text-muted-foreground">{t('noUnassignedScenes')}</p>
                  )}
                </div>
              )}
            </>
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

      <Dialog open={isAddCrewOpen} onOpenChange={setIsAddCrewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addCrew')}</DialogTitle>
            <DialogDescription>{t('addCrewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crew-member">{t('selectMember')}</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger id="crew-member">
                  <SelectValue placeholder={t('selectMemberPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="production-function">{t('productionFunction')}</Label>
              <Input
                id="production-function"
                value={productionFunction}
                onChange={(e) => setProductionFunction(e.target.value)}
                placeholder={t('productionFunctionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddCrewOpen(false)
                setSelectedProfileId('')
                setProductionFunction('')
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (selectedProfileId && productionFunction.trim()) {
                  await addCrewMember.mutateAsync({
                    profile_id: selectedProfileId,
                    production_function: productionFunction
                  })
                  setIsAddCrewOpen(false)
                  setSelectedProfileId('')
                  setProductionFunction('')
                }
              }}
              disabled={!selectedProfileId || !productionFunction.trim() || addCrewMember.isPending}
            >
              {addCrewMember.isPending ? t('adding') : t('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
