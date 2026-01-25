'use client'

import { useState } from 'react'
import { useShootingDays, useDeleteShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Edit, Trash2, Clock, MapPin, Eye } from 'lucide-react'
import Link from 'next/link'
import { convertTimeToFormFormat, ShootingDay } from '@/types'

interface ShootingDaysTabProps {
  projectId: string
}

export function ShootingDaysTab({ projectId }: ShootingDaysTabProps) {
  const { organizationId } = useAuth()
  const { data: shootingDays, isLoading, error } = useShootingDays(organizationId || '', projectId)
  const deleteShootingDay = useDeleteShootingDay(organizationId || '')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(shootingDayId: string) {
    if (!confirm('Are you sure you want to delete this shooting day?')) {
      return
    }

    try {
      setDeletingId(shootingDayId)
      await deleteShootingDay.mutateAsync(shootingDayId)
    } catch (err: unknown) {
      console.error('Failed to delete shooting day:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <div>Loading shooting days...</div>
  }

  if (error) {
    return <div>Error loading shooting days: {error.message}</div>
  }

  // Sort by date
  const sortedShootingDays = [...(shootingDays || [])].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Shooting Schedule</h3>
          <p className="text-sm text-muted-foreground">
            Manage shooting days and scene assignments
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/shooting-days/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Shooting Day
          </Link>
        </Button>
      </div>

      {sortedShootingDays.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedShootingDays.map((day) => (
            <ShootingDayCard
              key={day.id}
              shootingDay={day}
              onDelete={handleDelete}
              isDeleting={deletingId === day.id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Shooting Days Scheduled</CardTitle>
            <CardDescription>
              Create your first shooting day to start planning the production schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Organize scenes into shooting days for efficient production
              </p>
              <Button asChild>
                <Link href={`/shooting-days/new?project=${projectId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule First Day
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface ShootingDayCardProps {
  shootingDay: ShootingDay
  onDelete: (id: string) => void
  isDeleting: boolean
}

function ShootingDayCard({ shootingDay, onDelete, isDeleting }: ShootingDayCardProps) {
  const formattedDate = new Date(shootingDay.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{formattedDate}</CardTitle>
            <CardDescription>{shootingDay.location_name}</CardDescription>
          </div>
          <Badge variant="outline">
            {new Date(shootingDay.date).getFullYear()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Times */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Call:</span>
            <span>{convertTimeToFormFormat(shootingDay.call_time)}</span>
          </div>
          {shootingDay.wrap_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Wrap:</span>
              <span>{convertTimeToFormFormat(shootingDay.wrap_time)}</span>
            </div>
          )}
        </div>

        {/* Location Address */}
        {shootingDay.location_address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-muted-foreground line-clamp-1">{shootingDay.location_address}</span>
          </div>
        )}

        {/* Notes */}
        {shootingDay.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2 italic">
            {shootingDay.notes}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(shootingDay.id)}
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
