'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useShootingDay, useDeleteShootingDay, useScenes, useAssignScenesToShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Trash2, ArrowLeft, Calendar, Clock, MapPin, CloudSun, FileText, Film } from 'lucide-react'
import Link from 'next/link'
import { convertTimeToFormFormat } from '@/types'

export default function ShootingDayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const shootingDayId = params.id as string

  const [selectedScenes, setSelectedScenes] = useState<string[]>([])
  const [assignmentMessage, setAssignmentMessage] = useState<string>('')

  const { data: shootingDay, isLoading, error } = useShootingDay(shootingDayId)
  const deleteShootingDay = useDeleteShootingDay(organizationId || '')

  // Fetch scenes for the project (once we know the project_id)
  const { data: allScenes } = useScenes(shootingDay?.project_id || '')
  const assignScenes = useAssignScenesToShootingDay(shootingDayId, organizationId || '')

  if (isLoading) {
    return <div>Loading shooting day...</div>
  }

  if (error || !shootingDay) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Shooting day not found</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this shooting day?')) return

    try {
      await deleteShootingDay.mutateAsync(shootingDayId)
      router.push('/shooting-days')
    } catch (err) {
      console.error('Failed to delete shooting day:', err)
    }
  }

  const formattedDate = new Date(shootingDay.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{formattedDate}</h1>
            <p className="text-muted-foreground">{shootingDay.location_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/shooting-days/${shootingDayId}/edit`}>
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

      <Badge variant="outline" className="text-base px-4 py-2">
        <Calendar className="mr-2 h-4 w-4" />
        {new Date(shootingDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </Badge>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Details</CardTitle>
          <CardDescription>Call times and shooting schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Call Time</div>
                <div className="text-xl font-semibold">{convertTimeToFormFormat(shootingDay.call_time)}</div>
              </div>
            </div>

            {shootingDay.wrap_time && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Wrap Time</div>
                  <div className="text-xl font-semibold">{convertTimeToFormFormat(shootingDay.wrap_time)}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Information</CardTitle>
          <CardDescription>Shooting location details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-muted-foreground">Location</div>
              <div className="text-lg font-semibold">{shootingDay.location_name}</div>
              {shootingDay.location_address && (
                <div className="text-sm text-muted-foreground mt-1">{shootingDay.location_address}</div>
              )}
            </div>
          </div>

          {shootingDay.weather_forecast && (
            <div className="flex items-start gap-3">
              <CloudSun className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-sm font-medium text-muted-foreground">Weather Forecast</div>
                <div className="text-base">{shootingDay.weather_forecast}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {shootingDay.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Production Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-base whitespace-pre-wrap flex-1">{shootingDay.notes}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scene Assignment</CardTitle>
          <CardDescription>Assign scenes to this shooting day</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignmentMessage && (
            <Alert>
              <AlertDescription>{assignmentMessage}</AlertDescription>
            </Alert>
          )}

          {allScenes && allScenes.length > 0 ? (
            <>
              <div className="space-y-2">
                {allScenes.map((scene) => {
                  const isAssigned = scene.shooting_day_id === shootingDayId
                  const isSelected = selectedScenes.includes(scene.id)

                  return (
                    <div key={scene.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`scene-${scene.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedScenes([...selectedScenes, scene.id])
                          } else {
                            setSelectedScenes(selectedScenes.filter(id => id !== scene.id))
                          }
                        }}
                      />
                      <label htmlFor={`scene-${scene.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Scene {scene.scene_number}</span>
                          {isAssigned && (
                            <Badge variant="secondary" className="text-xs">Currently Assigned</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {scene.heading}
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>

              <Button
                onClick={async () => {
                  try {
                    setAssignmentMessage('')
                    await assignScenes.mutateAsync(selectedScenes)
                    setAssignmentMessage(`Successfully assigned ${selectedScenes.length} scene(s)`)
                    setSelectedScenes([])
                  } catch (err: unknown) {
                    const error = err as Error
                    setAssignmentMessage(`Error: ${error.message}`)
                  }
                }}
                disabled={selectedScenes.length === 0 || assignScenes.isPending}
              >
                <Film className="mr-2 h-4 w-4" />
                {assignScenes.isPending ? 'Assigning...' : `Assign ${selectedScenes.length} Scene(s)`}
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              No scenes found for this project. <Link href={`/scenes/new?project=${shootingDay.project_id}`} className="text-primary hover:underline">Create a scene</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
