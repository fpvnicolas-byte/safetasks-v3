'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useCallSheet, useUpdateCallSheet } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { CallSheetFormData, convertTimeToBackendFormat, convertTimeToFormFormat } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function EditCallSheetPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('callSheets.edit')
  const tCommon = useTranslations('common')
  const { organizationId } = useAuth()
  const callSheetId = params.id as string

  const { data: callSheet, isLoading: isLoadingCallSheet, error: callSheetError } = useCallSheet(callSheetId)
  const updateCallSheet = useUpdateCallSheet(callSheetId, organizationId || '')

  const { errorDialog, showError, closeError } = useErrorDialog()
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize form data when call sheet loads
  useEffect(() => {
    if (callSheet && !isInitialized) {
      // The form will be pre-populated via defaultValue attributes
      setIsInitialized(true)
    }
  }, [callSheet, isInitialized])

  if (isLoadingCallSheet) {
    return <div>{t('loading')}</div>
  }

  if (callSheetError) {
    return <div>{t('error', { message: callSheetError.message })}</div>
  }

  if (!callSheet) {
    return <div>{t('notFound')}</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data: Partial<CallSheetFormData> = {
        shooting_day: formData.get('shooting_day') as string,
        status: formData.get('status') as 'draft' | 'confirmed' | 'completed',
        location: (formData.get('location') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        parking_info: (formData.get('parking_info') as string || '').trim() || undefined,
        crew_call: convertTimeToBackendFormat(formData.get('crew_call') as string),
        on_set: convertTimeToBackendFormat(formData.get('on_set') as string),
        lunch_time: convertTimeToBackendFormat(formData.get('lunch_time') as string),
        wrap_time: (formData.get('wrap_time') as string || '') ? convertTimeToBackendFormat(formData.get('wrap_time') as string) : undefined,
        weather: (formData.get('weather') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
        hospital_info: (formData.get('hospital_info') as string).trim(),
      }

      await updateCallSheet.mutateAsync(data)
      router.push(`/${locale}/call-sheets/${callSheetId}`)
    } catch (err: any) {
      console.error('Update call sheet error:', err)
      showError(err, t('errors.updateTitle'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>
              {t('description', { date: callSheet.shooting_day })}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('basicInfo')}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shooting_day">{t('shootingDay')}</Label>
                  <Input
                    id="shooting_day"
                    name="shooting_day"
                    type="date"
                    defaultValue={callSheet.shooting_day}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">{t('status')}</Label>
                  <Select name="status" defaultValue={callSheet.status} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{tCommon('draft')}</SelectItem>
                      <SelectItem value="confirmed">{t('statusConfirmed')}</SelectItem>
                      <SelectItem value="completed">{tCommon('completed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Call Times */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('callTimes')}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="crew_call">{t('crewCall')}</Label>
                  <Input
                    id="crew_call"
                    name="crew_call"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.crew_call)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('crewCallHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="on_set">{t('onSet')}</Label>
                  <Input
                    id="on_set"
                    name="on_set"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.on_set)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lunch_time">{t('lunch')}</Label>
                  <Input
                    id="lunch_time"
                    name="lunch_time"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.lunch_time)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wrap_time">{t('wrap')}</Label>
                  <Input
                    id="wrap_time"
                    name="wrap_time"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.wrap_time)}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('location')}</h3>

              <div className="space-y-2">
                <Label htmlFor="location">{t('locationName')}</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder={t('locationPlaceholder')}
                  defaultValue={callSheet.location || ''}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_address">{t('locationAddress')}</Label>
                <Input
                  id="location_address"
                  name="location_address"
                  placeholder={t('locationAddressPlaceholder')}
                  defaultValue={callSheet.location_address || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parking_info">{t('parking')}</Label>
                <Textarea
                  id="parking_info"
                  name="parking_info"
                  placeholder={t('parkingPlaceholder')}
                  rows={2}
                  defaultValue={callSheet.parking_info || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">{t('weather')}</Label>
                <Input
                  id="weather"
                  name="weather"
                  placeholder={t('weatherPlaceholder')}
                  defaultValue={callSheet.weather || ''}
                />
              </div>
            </div>

            {/* Emergency Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive">{t('safety')}</h3>

              <div className="space-y-2">
                <Label htmlFor="hospital_info">{t('hospital')}</Label>
                <Textarea
                  id="hospital_info"
                  name="hospital_info"
                  placeholder={t('hospitalPlaceholder')}
                  rows={3}
                  defaultValue={callSheet.hospital_info || ''}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('hospitalHelp')}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder={t('notesPlaceholder')}
                rows={4}
                defaultValue={callSheet.notes || ''}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={updateCallSheet.isPending}>
              {updateCallSheet.isPending ? tCommon('saving') : tCommon('save')}
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
