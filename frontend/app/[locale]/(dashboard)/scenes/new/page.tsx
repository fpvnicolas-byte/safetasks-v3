'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateScene } from '@/lib/api/hooks'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { DayNight, InternalExternal } from '@/types'

export const dynamic = 'force-dynamic'

function NewSceneForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''

  const { errorDialog, showError, closeError } = useErrorDialog()
  const createScene = useCreateScene()

  if (!projectId) {
    return <div className="p-8 text-destructive">Project ID is required. Please select a project first.</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const sceneNumber = parseInt(formData.get('scene_number') as string)
      const estimatedTime = parseInt(formData.get('estimated_time_minutes') as string)

      if (!sceneNumber || sceneNumber <= 0) {
        showError({ message: 'Scene number must be a positive integer' }, 'Validation Error')
        return
      }

      if (!estimatedTime || estimatedTime <= 0) {
        showError({ message: 'Estimated time must be a positive number' }, 'Validation Error')
        return
      }

      const data = {
        project_id: projectId,
        scene_number: sceneNumber, // INTEGER, not string
        heading: formData.get('heading') as string,
        description: formData.get('description') as string,
        day_night: formData.get('day_night') as DayNight, // Backend field name (lowercase values)
        internal_external: formData.get('internal_external') as InternalExternal, // Backend field name
        estimated_time_minutes: estimatedTime, // Backend field name (REQUIRED, not nullable)
      }

      await createScene.mutateAsync(data)
      router.push(`/scenes?project=${projectId}`)
    } catch (err: any) {
      console.error('Create scene error:', err)
      showError(err, 'Error Creating Scene')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Scene</CardTitle>
            <CardDescription>Add a new scene to your project</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scene_number">
                  Scene Number *
                  <span className="text-xs text-muted-foreground ml-2">(Integer only)</span>
                </Label>
                <Input
                  id="scene_number"
                  name="scene_number"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="5"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use whole numbers only (1, 2, 3...). For variations use heading.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="heading">Scene Heading *</Label>
                <Input
                  id="heading"
                  name="heading"
                  placeholder="COFFEE SHOP"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="John enters the coffee shop and orders a latte..."
                rows={3}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="internal_external">Interior/Exterior *</Label>
                <Select name="internal_external" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal (Interior)</SelectItem>
                    <SelectItem value="external">External (Exterior)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="day_night">Day/Night *</Label>
                <Select name="day_night" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time of day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                    <SelectItem value="dawn">Dawn</SelectItem>
                    <SelectItem value="dusk">Dusk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="estimated_time_minutes">
                  Estimated Time (minutes) *
                </Label>
                <Input
                  id="estimated_time_minutes"
                  name="estimated_time_minutes"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="5"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Required. Must be greater than 0.
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
              Cancel
            </Button>
            <Button type="submit" disabled={createScene.isPending}>
              {createScene.isPending ? 'Creating...' : 'Create Scene'}
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

export default function NewScenePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewSceneForm />
    </Suspense>
  )
}
