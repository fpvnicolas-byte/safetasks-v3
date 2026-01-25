'use client'

import { useState } from 'react'
import { useCallSheets } from '@/lib/api/hooks'
import { apiClient } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Edit, Trash2, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { formatTime } from '@/lib/utils/time'
import { CallSheet } from '@/types'
import { useQueryClient } from '@tanstack/react-query'

interface CallSheetsTabProps {
  projectId: string
}

export function CallSheetsTab({ projectId }: CallSheetsTabProps) {
  const { data: callSheets, isLoading, error } = useCallSheets(projectId)
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(callSheetId: string) {
    if (!confirm('Are you sure you want to delete this call sheet?')) {
      return
    }

    try {
      setDeletingId(callSheetId)
      await apiClient.delete(`/call-sheets/${callSheetId}`)
      // Invalidate and refetch call sheets
      queryClient.invalidateQueries({ queryKey: ['callSheets', projectId] })
    } catch (err: unknown) {
      console.error('Failed to delete call sheet:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <div>Loading call sheets...</div>
  }

  if (error) {
    return <div>Error loading call sheets: {error.message}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Call Sheets</h3>
          <p className="text-sm text-muted-foreground">
            Manage shooting day schedules and logistics
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/call-sheets/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Call Sheet
          </Link>
        </Button>
      </div>

      {callSheets && callSheets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {callSheets.map((callSheet) => (
            <CallSheetCard
              key={callSheet.id}
              callSheet={callSheet}
              onDelete={handleDelete}
              isDeleting={deletingId === callSheet.id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Call Sheets Yet</CardTitle>
            <CardDescription>
              Create your first call sheet to organize shooting schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Call sheets help coordinate crew, talent, and logistics for each shooting day
              </p>
              <Button asChild>
                <Link href={`/call-sheets/new?project=${projectId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Call Sheet
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface CallSheetCardProps {
  callSheet: CallSheet
  onDelete: (callSheetId: string) => void
  isDeleting: boolean
}

function CallSheetCard({ callSheet, onDelete, isDeleting }: CallSheetCardProps) {
  const shootDate = new Date(callSheet.shoot_date).toLocaleDateString()

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Day {callSheet.shooting_day_number}</CardTitle>
            <CardDescription>{shootDate}</CardDescription>
          </div>
          <Badge variant={callSheet.status === 'published' ? 'default' : 'secondary'}>
            {callSheet.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">{callSheet.location_name}</div>
            {callSheet.location_address && (
              <div className="text-sm text-muted-foreground">{callSheet.location_address}</div>
            )}
          </div>
        </div>

        {/* Call Times */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="font-medium text-muted-foreground">Crew Call</div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(callSheet.crew_call_time)}
            </div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Talent Call</div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(callSheet.talent_call_time)}
            </div>
          </div>
        </div>

        {/* Weather */}
        {callSheet.weather_forecast && (
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Weather: </span>
            {callSheet.weather_forecast}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/call-sheets/${callSheet.id}`}>
              <Edit className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(callSheet.id)}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
