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
import { useLocale, useTranslations } from 'next-intl'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'

function ShootingDaysContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('shootingDays')

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

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete,
    additionalData
  } = useConfirmDelete()

  const handleDeleteShootingDay = async () => {
    if (!idToDelete) return

    try {
      await deleteShootingDay.mutateAsync(idToDelete)
      cancelDelete()
    } catch (err: unknown) {
      cancelDelete()
      showError(err, t('list.deleteError'))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {projectId && (
          <Button asChild>
            <Link href={`/shooting-days/new?project=${projectId}`}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newShootingDay')}
            </Link>
          </Button>
        )}
      </div>

      {/* Search Filter */}
      <Card>
        <CardHeader>
          <CardTitle>{t('list.searchTitle')}</CardTitle>
          <CardDescription>
            {t('list.searchDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('list.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-center h-10 px-4 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {sortedShootingDays.length !== 1 ? t('list.dayCount_other', { count: sortedShootingDays.length }) : t('list.dayCount', { count: 1 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shooting Days Grid */}
      {isLoading ? (
        <div>{t('list.loading')}</div>
      ) : error ? (
        <div>{t('list.error', { message: error.message })}</div>
      ) : sortedShootingDays.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedShootingDays.map((day) => (
            <ShootingDayCard
              key={day.id}
              shootingDay={day}
              onDelete={() => confirmDelete(day.id, day.date)}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('list.noResults')}</CardTitle>
            <CardDescription>
              {searchQuery
                ? t('list.noMatches')
                : t('list.noDays')
              }
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteShootingDay}
        title={t('list.deleteTitle')}
        description={additionalData ? t('list.deleteDescription', { date: new Date(additionalData as string).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }) : t('list.deleteConfirmGeneric')}
        loading={deleteShootingDay.isPending}
      />
    </div>
  )
}

interface ShootingDayCardProps {
  shootingDay: ShootingDay
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
  locale: string
}

function ShootingDayCard({ shootingDay, onDelete, t, locale }: ShootingDayCardProps) {
  const formattedDate = new Date(shootingDay.date).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <Link href={`/projects/${shootingDay.project_id}`} className="flex-1 cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {formattedDate}
              </CardTitle>
              {shootingDay.project && (
                <div className="mt-1">
                  <p className="text-sm font-semibold text-primary">{shootingDay.project.title}</p>
                  {shootingDay.project.client && (
                    <p className="text-xs text-muted-foreground">{shootingDay.project.client.name}</p>
                  )}
                </div>
              )}
            </div>
            <Badge variant="outline">
              {new Date(shootingDay.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-2">
          <div className="space-y-1">
            <p className="font-medium text-sm">{shootingDay.location_name}</p>
            {shootingDay.location_address && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5" />
                <span className="line-clamp-1">{shootingDay.location_address}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{t('list.call')} {convertTimeToFormFormat(shootingDay.call_time)}</span>
            </div>
            {shootingDay.wrap_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{t('list.wrap')} {convertTimeToFormFormat(shootingDay.wrap_time)}</span>
              </div>
            )}
          </div>

          {shootingDay.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 italic">
              "{shootingDay.notes}"
            </p>
          )}
        </CardContent>
      </Link>

      <div className="p-6 pt-0 mt-auto">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('list.view')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {t('list.edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
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
