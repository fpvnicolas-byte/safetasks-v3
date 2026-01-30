'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCreateCallSheet, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { CallSheetFormData, convertTimeToBackendFormat } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useTranslations } from 'next-intl'

export const dynamic = 'force-dynamic'

function NewCallSheetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId } = useAuth()
  const projectIdFromUrl = searchParams.get('project') || ''
  const t = useTranslations('callSheets.edit') // Reusing edit keys where applicable
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdFromUrl)
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Fetch projects for the dropdown
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId || undefined)
  const createCallSheet = useCreateCallSheet(selectedProjectId, organizationId || '')

  // If URL has project ID, use it; otherwise show project selector
  const needsProjectSelection = !projectIdFromUrl && !selectedProjectId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data: CallSheetFormData = {
        project_id: selectedProjectId,
        shooting_day: formData.get('shooting_day') as string,
        status: formData.get('status') as 'draft' | 'confirmed' | 'completed',
        location: (formData.get('location') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        parking_info: (formData.get('parking_info') as string || '').trim() || undefined,
        crew_call: convertTimeToBackendFormat(formData.get('crew_call') as string),
        on_set: convertTimeToBackendFormat(formData.get('on_set') as string),
        lunch_time: convertTimeToBackendFormat(formData.get('lunch_time') as string),
        wrap_time: (formData.get('wrap_time') as string || '') ? convertTimeToBackendFormat(formData.get('wrap_time') as string) : undefined,
        weather: (formData.get('weather') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
        hospital_info: (formData.get('hospital_info') as string).trim(),
      }

      await createCallSheet.mutateAsync(data)
      router.push(`/projects/${selectedProjectId}?tab=call-sheets`)
    } catch (err: any) {
      showError(err, tFeedback('actionError', { message: tCommon('create') }))
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Call Sheet</CardTitle>
            <CardDescription>Add call sheet details for your shooting day</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Project Selection (if not from URL) */}
            {needsProjectSelection && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium">Select a project to create a call sheet:</p>
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
                  <Label htmlFor="shooting_day">Shooting Day *</Label>
                  <Input
                    id="shooting_day"
                    name="shooting_day"
                    type="date"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue="draft" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Call Times */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Call Times</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="crew_call">Crew Call Time *</Label>
                  <Input
                    id="crew_call"
                    name="crew_call"
                    type="time"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    HTML time inputs use HH:MM, will be converted to HH:MM:SS for backend
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="on_set">On Set Time *</Label>
                  <Input
                    id="on_set"
                    name="on_set"
                    type="time"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lunch_time">Lunch Time *</Label>
                  <Input
                    id="lunch_time"
                    name="lunch_time"
                    type="time"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wrap_time">Wrap Time</Label>
                  <Input
                    id="wrap_time"
                    name="wrap_time"
                    type="time"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location</h3>

              <div className="space-y-2">
                <Label htmlFor="location">Location Name *</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Studio A"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="parking_info">Parking Information</Label>
                <Textarea
                  id="parking_info"
                  name="parking_info"
                  placeholder="Parking details and instructions..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">Weather Forecast</Label>
                <Input
                  id="weather"
                  name="weather"
                  placeholder="Sunny, 75°F"
                />
              </div>
            </div>

            {/* Emergency Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">🚨 Safety & Emergency</h3>

              <div className="space-y-2">
                <Label htmlFor="hospital_info">Nearest Hospital/Emergency Contact *</Label>
                <Textarea
                  id="hospital_info"
                  name="hospital_info"
                  placeholder="Hospital name, address, phone number, and directions..."
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Required for professional call sheets - critical emergency information
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Production Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Additional production notes..."
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCallSheet.isPending || !selectedProjectId}
            >
              {createCallSheet.isPending ? 'Creating...' : 'Create Call Sheet'}
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

export default function NewCallSheetPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewCallSheetForm />
    </Suspense>
  )
}
