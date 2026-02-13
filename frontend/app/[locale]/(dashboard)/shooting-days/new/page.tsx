'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCreateShootingDay, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ShootingDayFormData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useTranslations } from 'next-intl'

export const dynamic = 'force-dynamic'

function NewShootingDayForm() {
  const t = useTranslations('shootingDays.form')
  const commonT = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId } = useAuth()
  const projectIdFromUrl = searchParams.get('project') || ''

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdFromUrl)
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Fetch projects for the dropdown
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId || undefined)
  const createShootingDay = useCreateShootingDay(selectedProjectId, organizationId || '')

  // If URL has project ID, use it; otherwise show project selector
  const needsProjectSelection = !projectIdFromUrl && !selectedProjectId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data: ShootingDayFormData = {
        date: formData.get('date') as string,
        call_time: formData.get('call_time') as string,
        on_set: (formData.get('on_set') as string || '') || undefined,
        lunch_time: (formData.get('lunch_time') as string || '') || undefined,
        wrap_time: (formData.get('wrap_time') as string || '') || undefined,
        location_name: (formData.get('location_name') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        parking_info: (formData.get('parking_info') as string || '').trim() || undefined,
        hospital_info: (formData.get('hospital_info') as string || '').trim() || undefined,
        weather_forecast: (formData.get('weather_forecast') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await createShootingDay.mutateAsync(data)
      router.push(`/projects/${selectedProjectId}?tab=shooting-days`)
    } catch (err: unknown) {
      showError(err, t('errorCreating'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('scheduleTitle')}</CardTitle>
            <CardDescription>{t('scheduleDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Project Selection (if not from URL) */}
            {needsProjectSelection && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium">{t('selectProject')}</p>
                    {projectsLoading ? (
                      <p className="text-sm">{t('loadingProjects')}</p>
                    ) : projects && projects.length > 0 ? (
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('chooseProject')} />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm">{t('noProjectsCreateFirst')}</p>
                        <Button asChild size="sm">
                          <Link href="/projects/new">{t('createProject')}</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Schedule Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('scheduleDetails')}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">{t('shootingDate')}</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="call_time">{t('generalCallTime')}</Label>
                  <Input
                    id="call_time"
                    name="call_time"
                    type="time"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('generalCallTimeHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="on_set">{t('shootingCall')}</Label>
                  <Input
                    id="on_set"
                    name="on_set"
                    type="time"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('shootingCallHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lunch_time">{t('lunchTime')}</Label>
                  <Input
                    id="lunch_time"
                    name="lunch_time"
                    type="time"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wrap_time">{t('estimatedWrap')}</Label>
                  <Input
                    id="wrap_time"
                    name="wrap_time"
                    type="time"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('locationSection')}</h3>

              <div className="space-y-2">
                <Label htmlFor="location_name">{t('locationName')}</Label>
                <Input
                  id="location_name"
                  name="location_name"
                  placeholder={t('locationNamePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_address">{t('address')}</Label>
                <Input
                  id="location_address"
                  name="location_address"
                  placeholder={t('addressPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parking_info">{t('parkingInfo')}</Label>
                <Textarea
                  id="parking_info"
                  name="parking_info"
                  placeholder={t('parkingInfoPlaceholder')}
                  rows={2}
                />
              </div>
            </div>

            {/* Safety & Logistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('safetyLogistics')}</h3>

              <div className="space-y-2">
                <Label htmlFor="hospital_info">{t('nearestHospital')}</Label>
                <Textarea
                  id="hospital_info"
                  name="hospital_info"
                  placeholder={t('nearestHospitalPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather_forecast">{t('weatherForecast')}</Label>
                <Input
                  id="weather_forecast"
                  name="weather_forecast"
                  placeholder={t('weatherForecastPlaceholder')}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('notesSection')}</h3>
              <div className="space-y-2">
                <Label htmlFor="notes">{t('generalNotes')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('generalNotesPlaceholder')}
                  rows={4}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {commonT('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createShootingDay.isPending || !selectedProjectId}
            >
              {createShootingDay.isPending ? t('creating') : t('scheduleAction')}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}

export default function NewShootingDayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewShootingDayForm />
    </Suspense>
  )
}
