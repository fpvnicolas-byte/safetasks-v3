'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useCharacter, useUpdateCharacter } from '@/lib/api/hooks'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { FormSkeleton } from '@/components/LoadingSkeletons'

export default function EditCharacterPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('characters.edit')
  const tCommon = useTranslations('common')
  const characterId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: character, isLoading } = useCharacter(characterId)
  const updateCharacter = useUpdateCharacter()

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

  if (!character) {
    return <div className="p-8 text-destructive">{t('errors.notFound', { defaultMessage: 'Character not found' })}</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const characterData = {
        name: (formData.get('name') as string).trim(),
        description: (formData.get('description') as string).trim(),
        actor_name: (formData.get('actor_name') as string || '').trim() || undefined,
      }

      await updateCharacter.mutateAsync({ characterId, data: characterData })
      router.push(`/${locale}/characters/${characterId}`)
    } catch (err: any) {
      console.error('Update character error:', err)
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

          <CardContent className="space-y-6">

            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={character.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t('descriptionPlaceholder')}
                rows={4}
                defaultValue={character.description}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actor_name">{t('actorName')}</Label>
              <Input
                id="actor_name"
                name="actor_name"
                placeholder="John Doe"
                defaultValue={character.actor_name || ''}
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
            <Button type="submit" disabled={updateCharacter.isPending}>
              {updateCharacter.isPending ? tCommon('saving') : tCommon('save')}
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
