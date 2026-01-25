'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useScene, useUpdateScene } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormSkeleton } from '@/components/LoadingSkeletons'
import { DayNight, InternalExternal } from '@/types'

export default function EditScenePage() {
  const router = useRouter()
  const params = useParams()
  const sceneId = params.id as string

  const [error, setError] = useState<string | null>(null)
  const { data: scene, isLoading } = useScene(sceneId)
  const updateScene = useUpdateScene()

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Scene</CardTitle>
            <CardDescription>Update scene details</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!scene) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Scene not found</AlertDescription>
      </Alert>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const sceneNumber = parseInt(formData.get('scene_number') as string)
      const estimatedTime = parseInt(formData.get('estimated_time_minutes') as string)

      if (!sceneNumber || sceneNumber <= 0) {
        setError('Scene number must be a positive integer')
        return
      }

      if (!estimatedTime || estimatedTime <= 0) {
        setError('Estimated time must be a positive number')
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
      router.push(`/scenes/${sceneId}`)
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to update scene')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Scene</CardTitle>
            <CardDescription>Update scene details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

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
                  defaultValue={scene.scene_number}
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
                  defaultValue={scene.heading}
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
                defaultValue={scene.description}
                placeholder="John enters the coffee shop and orders a latte..."
                rows={3}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="internal_external">Interior/Exterior *</Label>
                <Select name="internal_external" defaultValue={scene.internal_external} required>
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
                <Select name="day_night" defaultValue={scene.day_night} required>
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
                  defaultValue={scene.estimated_time_minutes}
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
            <Button type="submit" disabled={updateScene.isPending}>
              {updateScene.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
