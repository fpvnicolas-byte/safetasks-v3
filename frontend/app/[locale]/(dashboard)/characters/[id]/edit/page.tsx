'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  const characterId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: character, isLoading } = useCharacter(characterId)
  const updateCharacter = useUpdateCharacter()

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Character</CardTitle>
            <CardDescription>Update character details</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!character) {
    return <div className="p-8 text-destructive">Character not found</div>
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
      router.push(`/characters/${characterId}`)
    } catch (err: any) {
      console.error('Update character error:', err)
      showError(err, 'Error Updating Character')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Character</CardTitle>
            <CardDescription>Update character details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            <div className="space-y-2">
              <Label htmlFor="name">Character Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={character.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Character description, role in the story..."
                rows={4}
                defaultValue={character.description}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actor_name">Actor Name</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={updateCharacter.isPending}>
              {updateCharacter.isPending ? 'Saving...' : 'Save Changes'}
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
