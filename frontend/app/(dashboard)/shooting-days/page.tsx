'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useShootingDays, useDeleteShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Calendar, Clock, MapPin, Eye } from 'lucide-react'
import Link from 'next/link'
import { ShootingDay, convertTimeToFormFormat } from '@/types'

function ShootingDaysContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''
  const { organizationId } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')

  // Get shooting days data
  const { data: allShootingDays, isLoading, error } = useShootingDays(organizationId || '', projectId || undefined)
  const deleteShootingDay = useDeleteShootingDay(organizationId || '')

  // Apply search filter
  const filteredShootingDays = allShootingDays?.filter(day => {
    const matchesSearch = !searchQuery ||
      day.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      day.date.includes(searchQuery) ||
      day.notes?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  }) || []

  // Sort by date (most recent first)
  const sortedShootingDays = [...filteredShootingDays].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const handleDeleteShootingDay = async (dayId: string, date: string) => {
    if (!confirm(`Are you sure you want to delete shooting day on ${new Date(date).toLocaleDateString()}? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteShootingDay.mutateAsync(dayId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete shooting day: ${error.message}`)
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shooting Days</h1>
          <p className="text-muted-foreground">
            Schedule and manage production shooting days
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Please select a project to manage shooting days
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
          <h1 className="text-3xl font-bold tracking-tight">Shooting Days</h1>
          <p className="text-muted-foreground">
            Schedule and manage production shooting days
          </p>
        </div>
        <Button asChild>
          <Link href={`/shooting-days/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Shooting Day
          </Link>
        </Button>
      </div>

      {/* Search Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search Shooting Days</CardTitle>
          <CardDescription>
            Find shooting days by date, location, or notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by location, date, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-center h-10 px-4 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {sortedShootingDays.length} day{sortedShootingDays.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shooting Days Grid */}
      {isLoading ? (
        <div>Loading shooting days...</div>
      ) : error ? (
        <div>Error loading shooting days: {error.message}</div>
      ) : sortedShootingDays.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedShootingDays.map((day) => (
            <ShootingDayCard
              key={day.id}
              shootingDay={day}
              onDelete={() => handleDeleteShootingDay(day.id, day.date)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Shooting Days Found</CardTitle>
            <CardDescription>
              {searchQuery
                ? 'No shooting days match your current search'
                : 'Get started by scheduling your first shooting day'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Shooting days help you plan and organize your production schedule
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
  onDelete: () => void
}

function ShootingDayCard({ shootingDay, onDelete }: ShootingDayCardProps) {
  const formattedDate = new Date(shootingDay.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {formattedDate}
            </CardTitle>
            <CardDescription className="font-medium">
              {shootingDay.location_name}
            </CardDescription>
          </div>
          <Badge variant="outline">
            {new Date(shootingDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Call: {convertTimeToFormFormat(shootingDay.call_time)}</span>
          </div>
          {shootingDay.wrap_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Wrap: {convertTimeToFormFormat(shootingDay.wrap_time)}</span>
            </div>
          )}
        </div>

        {shootingDay.location_address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground line-clamp-2">{shootingDay.location_address}</span>
          </div>
        )}

        {shootingDay.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {shootingDay.notes}
          </p>
        )}

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

export default function ShootingDaysPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShootingDaysContent />
    </Suspense>
  )
}
