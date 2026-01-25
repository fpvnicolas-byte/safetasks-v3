'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useShootingDay, useUpdateShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { convertTimeToFormFormat } from '@/types'

export default function EditShootingDayPage() {
  const router = useRouter()
  const params = useParams()
  const { organizationId } = useAuth()
  const shootingDayId = params.id as string

  const [error, setError] = useState<string | null>(null)
  const { data: shootingDay, isLoading } = useShootingDay(shootingDayId)
  const updateShootingDay = useUpdateShootingDay(shootingDayId, organizationId || '')

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Shooting Day</CardTitle>
            <CardDescription>Update shooting day details</CardDescription>
          </CardHeader>
          <CardContent>
            <div>Loading shooting day...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!shootingDay) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Shooting day not found</AlertDescription>
      </Alert>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const data = {
        date: formData.get('date') as string,
        call_time: formData.get('call_time') as string, // HTML time input (HH:MM)
        wrap_time: (formData.get('wrap_time') as string || '') || undefined,
        location_name: (formData.get('location_name') as string).trim(),
        location_address: (formData.get('location_address') as string || '').trim() || undefined,
        weather_forecast: (formData.get('weather_forecast') as string || '').trim() || undefined,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await updateShootingDay.mutateAsync(data)
      router.push(`/shooting-days/${shootingDayId}`)
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to update shooting day')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Shooting Day</CardTitle>
            <CardDescription>Update shooting day details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Shooting Date *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={shootingDay.date}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="call_time">Call Time *</Label>
                <Input
                  id="call_time"
                  name="call_time"
                  type="time"
                  defaultValue={convertTimeToFormFormat(shootingDay.call_time)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wrap_time">Estimated Wrap Time</Label>
                <Input
                  id="wrap_time"
                  name="wrap_time"
                  type="time"
                  defaultValue={shootingDay.wrap_time ? convertTimeToFormFormat(shootingDay.wrap_time) : ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_name">Location Name *</Label>
              <Input
                id="location_name"
                name="location_name"
                defaultValue={shootingDay.location_name}
                placeholder="e.g., Studio A, Central Park, Downtown Office"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">Location Address</Label>
              <Input
                id="location_address"
                name="location_address"
                defaultValue={shootingDay.location_address || ''}
                placeholder="123 Film Street, Los Angeles, CA 90001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weather_forecast">Weather Forecast</Label>
              <Input
                id="weather_forecast"
                name="weather_forecast"
                defaultValue={shootingDay.weather_forecast || ''}
                placeholder="e.g., Sunny, 75°F, 10% chance of rain"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Production Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={shootingDay.notes || ''}
                placeholder="Special instructions, equipment needed, safety considerations..."
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
              disabled={updateShootingDay.isPending}
            >
              {updateShootingDay.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
