'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useScenes, useDeleteScene } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Film, Clock, MapPin, Eye } from 'lucide-react'
import Link from 'next/link'
import { Scene, SceneLocation, SceneTimeOfDay } from '@/types'

const locationColors: Record<SceneLocation, string> = {
  INT: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  EXT: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
}

const timeOfDayColors: Record<SceneTimeOfDay, string> = {
  DAY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  NIGHT: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
  DAWN: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
  DUSK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200',
}

function ScenesContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''

  const [locationFilter, setLocationFilter] = useState<SceneLocation | 'all'>('all')
  const [timeOfDayFilter, setTimeOfDayFilter] = useState<SceneTimeOfDay | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Get scenes data
  const { data: allScenes, isLoading, error } = useScenes(projectId)
  const deleteScene = useDeleteScene()

  // Apply filters
  const filteredScenes = allScenes?.filter(scene => {
    const matchesLocation = locationFilter === 'all' || scene.location === locationFilter
    const matchesTimeOfDay = timeOfDayFilter === 'all' || scene.time_of_day === timeOfDayFilter
    const matchesSearch = !searchQuery ||
      scene.scene_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scene.description.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesLocation && matchesTimeOfDay && matchesSearch
  }) || []

  const handleDeleteScene = async (sceneId: string, sceneNumber: string) => {
    if (!confirm(`Are you sure you want to delete Scene ${sceneNumber}? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteScene.mutateAsync(sceneId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete scene: ${error.message}`)
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scenes</h1>
          <p className="text-muted-foreground">
            Scene management requires a project context
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Please select a project to manage scenes
              </p>
              <Button asChild>
                <Link href="/projects">Go to Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scenes</h1>
          <p className="text-muted-foreground">
            Manage your production scenes and script breakdown
          </p>
        </div>
        <Button asChild>
          <Link href={`/scenes/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Scene
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Scenes</CardTitle>
          <CardDescription>
            Find specific scenes by location, time of day, or search terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Scene number or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value as SceneLocation | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="INT">Interior (INT)</SelectItem>
                  <SelectItem value="EXT">Exterior (EXT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Time of Day</label>
              <Select value={timeOfDayFilter} onValueChange={(value) => setTimeOfDayFilter(value as SceneTimeOfDay | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Times</SelectItem>
                  <SelectItem value="DAY">Day</SelectItem>
                  <SelectItem value="NIGHT">Night</SelectItem>
                  <SelectItem value="DAWN">Dawn</SelectItem>
                  <SelectItem value="DUSK">Dusk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Results</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredScenes.length} scene{filteredScenes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenes Grid */}
      {isLoading ? (
        <div>Loading scenes...</div>
      ) : error ? (
        <div>Error loading scenes: {error.message}</div>
      ) : filteredScenes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onDelete={() => handleDeleteScene(scene.id, scene.scene_number)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Scenes Found</CardTitle>
            <CardDescription>
              {searchQuery || locationFilter !== 'all' || timeOfDayFilter !== 'all'
                ? 'No scenes match your current filters'
                : 'Get started by creating your first scene'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Scenes help break down your script into manageable production units
              </p>
              <Button asChild>
                <Link href={`/scenes/new?project=${projectId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Scene
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface SceneCardProps {
  scene: Scene
  onDelete: () => void
}

function SceneCard({ scene, onDelete }: SceneCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              Scene {scene.scene_number}
            </CardTitle>
            <CardDescription className="font-medium">
              {scene.description.split('.')[0] || 'No description'}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Badge className={locationColors[scene.location]}>
              {scene.location}
            </Badge>
            <Badge className={timeOfDayColors[scene.time_of_day]}>
              {scene.time_of_day}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {scene.description}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {scene.estimated_duration_minutes ? `${scene.estimated_duration_minutes} min` : 'No estimate'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {scene.estimated_duration_minutes ? `${scene.estimated_duration_minutes} min` : 'No duration'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/scenes/${scene.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/scenes/${scene.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ScenesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ScenesContent />
    </Suspense>
  )
}
