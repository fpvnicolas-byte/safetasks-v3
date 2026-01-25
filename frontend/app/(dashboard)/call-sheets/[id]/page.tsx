'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallSheet } from '@/lib/api/hooks'
import { apiClient } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Edit, Trash2, Clock, MapPin, Phone, User, Cloud, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatTime } from '@/lib/utils/time'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQueryClient } from '@tanstack/react-query'

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
}

export default function CallSheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const callSheetId = params.id as string

  const { data: callSheet, isLoading, error } = useCallSheet(callSheetId)
  const queryClient = useQueryClient()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this call sheet? This action cannot be undone.')) {
      return
    }

    try {
      await apiClient.delete(`/call-sheets/${callSheetId}`)
      // Invalidate and refetch call sheets for the project
      queryClient.invalidateQueries({ queryKey: ['callSheets', callSheet?.project_id] })
      router.push(`/projects/${callSheet?.project_id}?tab=call-sheets`)
    } catch (err: unknown) {
      const error = err as Error
      setDeleteError(error.message || 'Failed to delete call sheet')
    }
  }

  if (isLoading) {
    return <div>Loading call sheet...</div>
  }

  if (error) {
    return <div>Error loading call sheet: {error.message}</div>
  }

  if (!callSheet) {
    return <div>Call sheet not found</div>
  }

  const shootDate = new Date(callSheet.shooting_day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Call Sheet - {callSheet.project_id}
          </h1>
          <p className="text-muted-foreground">
            {shootDate} • {callSheet.location}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/call-sheets/${callSheetId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={statusColors[callSheet.status]}>
          {callSheet.status.charAt(0).toUpperCase() + callSheet.status.slice(1)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Created {new Date(callSheet.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Call Times */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Call Times
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Crew Call:</span>
              <span className="text-lg">{formatTime(callSheet.crew_call_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Talent Call:</span>
              <span className="text-lg">{formatTime(callSheet.talent_call_time)}</span>
            </div>
            {callSheet.breakfast_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Breakfast:</span>
                <span>{formatTime(callSheet.breakfast_time)}</span>
              </div>
            )}
            {callSheet.lunch_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Lunch:</span>
                <span>{formatTime(callSheet.lunch_time)}</span>
              </div>
            )}
            {callSheet.sunrise_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Sunrise:</span>
                <span>{formatTime(callSheet.sunrise_time)}</span>
              </div>
            )}
            {callSheet.sunset_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Sunset:</span>
                <span>{formatTime(callSheet.sunset_time)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-medium text-lg">{callSheet.location}</div>
              {callSheet.location_address && (
                <div className="text-sm text-muted-foreground mt-1">
                  {callSheet.location_address}
                </div>
              )}
            </div>
            {callSheet.weather_forecast && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  <span className="text-sm">{callSheet.weather_forecast}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Key Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Key Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {callSheet.director_name && (
              <div>
                <div className="font-medium">Director</div>
                <div className="text-sm">{callSheet.director_name}</div>
                {callSheet.director_phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    {callSheet.director_phone}
                  </div>
                )}
              </div>
            )}

            {callSheet.producer_name && (
              <div>
                <div className="font-medium">Producer</div>
                <div className="text-sm">{callSheet.producer_name}</div>
                {callSheet.producer_phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    {callSheet.producer_phone}
                  </div>
                )}
              </div>
            )}

            {callSheet.production_manager_name && (
              <div>
                <div className="font-medium">Production Manager</div>
                <div className="text-sm">{callSheet.production_manager_name}</div>
                {callSheet.production_manager_phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    {callSheet.production_manager_phone}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Emergency Information */}
      {callSheet.hospital_info && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">
              🚨 Emergency Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{callSheet.hospital_info}</p>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {callSheet.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Production Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{callSheet.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
