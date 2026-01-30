'use client'

import { useParams, useRouter } from 'next/navigation'
import { useScene, useDeleteScene } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'

export default function SceneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sceneId = params.id as string

  const { data: scene, isLoading, error } = useScene(sceneId)
  const deleteScene = useDeleteScene()

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error || !scene) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Scene not found</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scene?')) return

    try {
      await deleteScene.mutateAsync(sceneId)
      router.push('/scenes')
    } catch (err) {
      console.error('Failed to delete scene:', err)
    }
  }

  const timeColors = {
    day: 'bg-yellow-100 text-yellow-800',
    night: 'bg-purple-100 text-purple-800',
    dawn: 'bg-orange-100 text-orange-800',
    dusk: 'bg-pink-100 text-pink-800',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Scene {scene.scene_number}</h1>
            <p className="text-muted-foreground">{scene.heading}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/scenes/${sceneId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scene Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Location</div>
              <div className="text-lg">{scene.internal_external}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Time</div>
              <div className="text-lg">{scene.day_night}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Duration</div>
              <div className="text-lg">{scene.estimated_time_minutes} minutes</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Description</div>
            <div className="text-base whitespace-pre-wrap">{scene.description}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
