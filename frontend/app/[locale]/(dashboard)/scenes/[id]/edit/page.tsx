'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useScene, useUpdateScene } from '@/lib/api/hooks'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { FormSkeleton } from '@/components/LoadingSkeletons'
import { DayNight, InternalExternal } from '@/types'

export default function EditScenePage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('scenes.edit')
  const tCommon = useTranslations('common')
  const sceneId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: scene, isLoading } = useScene(sceneId)
  const updateScene = useUpdateScene()

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!scene) {
    return <div className="p-8 text-destructive">{t('errors.notFound', { defaultMessage: 'Scene not found' })}</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const sceneNumber = parseInt(formData.get('scene_number') as string)
      const estimatedTime = parseInt(formData.get('estimated_time_minutes') as string)

      if (!sceneNumber || sceneNumber <= 0) {
        showError({ message: t('errors.sceneNumberPositive') }, 'Validation Error')
        return
      }

      if (!estimatedTime || estimatedTime <= 0) {
        showError({ message: t('errors.estimatedTimePositive') }, 'Validation Error')
        return
      }

      const data = {
        scene_number: sceneNumber, // INTEGER, not string
        heading: formData.get('heading') as string,
        description: formData.get('description') as string,
        day_night: formData.get('day_night') as DayNight, // Backend field name (lowercase values)
        internal_external: formData.get('internal_external') as InternalExternal, // Backend field name
        estimated_time_minutes: estimatedTime, // Backend field name (REQUIRED, not nullable)
      }

      await updateScene.mutateAsync({ sceneId, data })
      router.push(`/${locale}/scenes/${sceneId}`)
    } catch (err: any) {
      console.error('Update scene error:', err)
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
                <Label htmlFor="scene_number">
                  {t('sceneNumber')}
                  <span className="text-xs text-muted-foreground ml-2">{t('integerOnly')}</span>
                </Label>
                <Input
                  id="scene_number"
                  name="scene_number"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={scene.scene_number}
                  placeholder="5"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('sceneNumberHelp')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="heading">{t('heading')}</Label>
                <Input
                  id="heading"
                  name="heading"
                  defaultValue={scene.heading}
                  placeholder="COFFEE SHOP"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={scene.description}
                placeholder="John enters the coffee shop and orders a latte..."
                rows={3}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="internal_external">{t('intExt')}</Label>
                <Select name="internal_external" defaultValue={scene.internal_external} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectLocation')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">{t('internal')}</SelectItem>
                    <SelectItem value="external">{t('external')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="day_night">{t('dayNight')}</Label>
                <Select name="day_night" defaultValue={scene.day_night} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTime')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{t('day')}</SelectItem>
                    <SelectItem value="night">{t('night')}</SelectItem>
                    <SelectItem value="dawn">{t('dawn')}</SelectItem>
                    <SelectItem value="dusk">{t('dusk')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="estimated_time_minutes">
                  {t('estimatedTime')}
                </Label>
                <Input
                  id="estimated_time_minutes"
                  name="estimated_time_minutes"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={scene.estimated_time_minutes}
                  placeholder="5"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('estimatedTimeHelp')}
                </p>
              </div>
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
            <Button type="submit" disabled={updateScene.isPending}>
              {updateScene.isPending ? tCommon('saving') : tCommon('save')}
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
