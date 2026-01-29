'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCreateShootingDay, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ShootingDayFormData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'

export const dynamic = 'force-dynamic'

function NewShootingDayForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId } = useAuth()
  const projectIdFromUrl = searchParams.get('project') || ''

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdFromUrl)
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Fetch projects for the dropdown
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId || undefined)
  const createShootingDay = useCreateShootingDay(selectedProjectId, organizationId || '')

  // If URL has project ID, use it; otherwise show project selector
  const needsProjectSelection = !projectIdFromUrl && !selectedProjectId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data: ShootingDayFormData = {
        date: formData.get('date') as string,
        call_time: formData.get('call_time') as string, // HTML time input (HH:MM)
        wrap_time: (formData.get('wrap_time') as string || '') || undefined,
        location_name: (formData.get('location_name') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        weather_forecast: (formData.get('weather_forecast') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await createShootingDay.mutateAsync(data)
      router.push(`/projects/${selectedProjectId}?tab=shooting-days`)
    } catch (err: any) {
      console.error('Create shooting day error:', err)
      showError(err, 'Error Creating Shooting Day')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Schedule New Shooting Day</CardTitle>
            <CardDescription>Add shooting day details for your production schedule</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Project Selection (if not from URL) */}
            {needsProjectSelection && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium">Select a project to schedule a shooting day:</p>
                    {projectsLoading ? (
                      <p className="text-sm">Loading projects...</p>
                    ) : projects && projects.length > 0 ? (
                      <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm">No projects found. Create a project first.</p>
                        <Button asChild size="sm">
                          <Link href="/projects/new">Create Project</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Show selected project name */}
                {selectedProjectId && projects && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Project</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {projects.find(p => p.id === selectedProjectId)?.title || 'Unknown Project'}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="date">Shooting Date *</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="call_time">Call Time *</Label>
                  <Input
                    id="call_time"
                    name="call_time"
                    type="time"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    When the crew should arrive on set
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wrap_time">Estimated Wrap Time</Label>
                  <Input
                    id="wrap_time"
                    name="wrap_time"
                    type="time"
                  />
                  <p className="text-xs text-muted-foreground">
                    Expected end time (optional)
                  </p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location Details</h3>

              <div className="space-y-2">
                <Label htmlFor="location_name">Location Name *</Label>
                <Input
                  id="location_name"
                  name="location_name"
                  placeholder="e.g., Studio A, Central Park, Downtown Office"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_address">Location Address</Label>
                <Input
                  id="location_address"
                  name="location_address"
                  placeholder="123 Film Street, Los Angeles, CA 90001"
                />
                <p className="text-xs text-muted-foreground">
                  Full address for crew navigation
                </p>
              </div>
            </div>

            {/* Weather & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Information</h3>

              <div className="space-y-2">
                <Label htmlFor="weather_forecast">Weather Forecast</Label>
                <Input
                  id="weather_forecast"
                  name="weather_forecast"
                  placeholder="e.g., Sunny, 75°F, 10% chance of rain"
                />
                <p className="text-xs text-muted-foreground">
                  Weather conditions for outdoor shoots
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Production Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Special instructions, equipment needed, safety considerations..."
                  rows={4}
                />
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
            <Button
              type="submit"
              disabled={createShootingDay.isPending || !selectedProjectId}
            >
              {createShootingDay.isPending ? 'Creating...' : 'Schedule Shooting Day'}
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

export default function NewShootingDayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewShootingDayForm />
    </Suspense>
  )
}
