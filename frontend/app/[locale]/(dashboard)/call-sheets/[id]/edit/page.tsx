'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCallSheet, useUpdateCallSheet } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { CallSheetFormData, convertTimeToBackendFormat, convertTimeToFormFormat } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function EditCallSheetPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const callSheetId = params.id as string

  const { data: callSheet, isLoading: isLoadingCallSheet, error: callSheetError } = useCallSheet(callSheetId)
  const updateCallSheet = useUpdateCallSheet(callSheetId, organizationId || '')

  const { errorDialog, showError, closeError } = useErrorDialog()
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize form data when call sheet loads
  useEffect(() => {
    if (callSheet && !isInitialized) {
      // The form will be pre-populated via defaultValue attributes
      setIsInitialized(true)
    }
  }, [callSheet, isInitialized])

  if (isLoadingCallSheet) {
    return <div>Loading call sheet...</div>
  }

  if (callSheetError) {
    return <div>Error loading call sheet: {callSheetError.message}</div>
  }

  if (!callSheet) {
    return <div>Call sheet not found</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const data: Partial<CallSheetFormData> = {
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

      await updateCallSheet.mutateAsync(data)
      router.push(`/call-sheets/${callSheetId}`)
    } catch (err: any) {
      console.error('Update call sheet error:', err)
      showError(err, 'Error Updating Call Sheet')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Call Sheet</CardTitle>
            <CardDescription>
              Update call sheet details for {callSheet.shooting_day}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shooting_day">Shooting Day *</Label>
                  <Input
                    id="shooting_day"
                    name="shooting_day"
                    type="date"
                    defaultValue={callSheet.shooting_day}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={callSheet.status} required>
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
                    defaultValue={convertTimeToFormFormat(callSheet.crew_call)}
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
                    defaultValue={convertTimeToFormFormat(callSheet.on_set)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lunch_time">Lunch Time *</Label>
                  <Input
                    id="lunch_time"
                    name="lunch_time"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.lunch_time)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wrap_time">Wrap Time</Label>
                  <Input
                    id="wrap_time"
                    name="wrap_time"
                    type="time"
                    defaultValue={convertTimeToFormFormat(callSheet.wrap_time)}
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
                  defaultValue={callSheet.location || ''}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_address">Location Address</Label>
                <Input
                  id="location_address"
                  name="location_address"
                  placeholder="123 Film Street, Los Angeles, CA 90001"
                  defaultValue={callSheet.location_address || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parking_info">Parking Information</Label>
                <Textarea
                  id="parking_info"
                  name="parking_info"
                  placeholder="Parking details and instructions..."
                  rows={2}
                  defaultValue={callSheet.parking_info || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">Weather Forecast</Label>
                <Input
                  id="weather"
                  name="weather"
                  placeholder="Sunny, 75°F"
                  defaultValue={callSheet.weather || ''}
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
                  defaultValue={callSheet.hospital_info || ''}
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
                defaultValue={callSheet.notes || ''}
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
            <Button type="submit" disabled={updateCallSheet.isPending}>
              {updateCallSheet.isPending ? 'Updating...' : 'Update Call Sheet'}
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
