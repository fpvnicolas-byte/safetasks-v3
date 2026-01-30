'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useShootingDay, useUpdateShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { convertTimeToFormFormat } from '@/types'

export default function EditShootingDayPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('shootingDays.edit')
  const tCommon = useTranslations('common')
  const { organizationId } = useAuth()
  const shootingDayId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: shootingDay, isLoading } = useShootingDay(shootingDayId)
  const updateShootingDay = useUpdateShootingDay(shootingDayId, organizationId || '')

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div>{t('loading')}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!shootingDay) {
    return <div className="p-8 text-destructive">{t('notFound')}</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data = {
        date: formData.get('date') as string,
        call_time: formData.get('call_time') as string, // HTML time input (HH:MM)
        wrap_time: (formData.get('wrap_time') as string || '') || undefined,
        location_name: (formData.get('location_name') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        weather_forecast: (formData.get('weather_forecast') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await updateShootingDay.mutateAsync(data)
      router.push(`/${locale}/shooting-days/${shootingDayId}`)
    } catch (err: any) {
      console.error('Update shooting day error:', err)
      showError(err, t('errors.updateTitle'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">{t('date')}</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={shootingDay.date}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="call_time">{t('callTime')}</Label>
                <Input
                  id="call_time"
                  name="call_time"
                  type="time"
                  defaultValue={convertTimeToFormFormat(shootingDay.call_time)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wrap_time">{t('wrapTime')}</Label>
                <Input
                  id="wrap_time"
                  name="wrap_time"
                  type="time"
                  defaultValue={shootingDay.wrap_time ? convertTimeToFormFormat(shootingDay.wrap_time) : ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_name">{t('locationName')}</Label>
              <Input
                id="location_name"
                name="location_name"
                defaultValue={shootingDay.location_name}
                placeholder={t('locationNamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">{t('locationAddress')}</Label>
              <Input
                id="location_address"
                name="location_address"
                defaultValue={shootingDay.location_address || ''}
                placeholder={t('locationAddressPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weather_forecast">{t('weather')}</Label>
              <Input
                id="weather_forecast"
                name="weather_forecast"
                defaultValue={shootingDay.weather_forecast || ''}
                placeholder={t('weatherPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={shootingDay.notes || ''}
                placeholder={t('notesPlaceholder')}
                rows={4}
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
            <Button
              type="submit"
              disabled={updateShootingDay.isPending}
            >
              {updateShootingDay.isPending ? tCommon('saving') : tCommon('save')}
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
