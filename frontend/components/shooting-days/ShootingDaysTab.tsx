'use client'

import { useState } from 'react'
import { useShootingDays, useDeleteShootingDay } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Edit, Trash2, Clock, MapPin, Eye, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { convertTimeToFormFormat, ShootingDay, ShootingDayStatus } from '@/types'

interface ShootingDaysTabProps {
  projectId: string
}

export function ShootingDaysTab({ projectId }: ShootingDaysTabProps) {
  const { organizationId } = useAuth()
  const { data: shootingDays, isLoading, error } = useShootingDays(organizationId || '', projectId)
  const deleteShootingDay = useDeleteShootingDay(organizationId || '')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const t = useTranslations('shootingDays')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  async function handleDelete(shootingDayId: string) {
    if (!confirm(t('tab.deleteConfirm'))) {
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
    return <div>{t('tab.loading')}</div>
  }

  if (error) {
    return <div>{t('tab.error', { message: error.message })}</div>
  }

  // Sort by date
  const sortedShootingDays = [...(shootingDays || [])].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('tab.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('tab.description')}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/shooting-days/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newShootingDay')}
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
              t={t}
              tCommon={tCommon}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('tab.empty.title')}</CardTitle>
            <CardDescription>
              {t('tab.empty.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('tab.empty.help')}
              </p>
              <Button asChild>
                <Link href={`/shooting-days/new?project=${projectId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('tab.empty.action')}
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
  t: (key: string) => string
  tCommon: (key: string) => string
  locale: string
}

function ShootingDayCard({ shootingDay, onDelete, isDeleting, t, tCommon, locale }: ShootingDayCardProps) {
  const formattedDate = new Date(shootingDay.date).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const statusVariant: Record<ShootingDayStatus, 'secondary' | 'info' | 'success'> = {
    draft: 'secondary',
    confirmed: 'info',
    completed: 'success',
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{formattedDate}</CardTitle>
            <CardDescription>{shootingDay.location_name}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={statusVariant[shootingDay.status]}>
              {t(`statusLabels.${shootingDay.status}`)}
            </Badge>
            <Badge variant="outline">
              {new Date(shootingDay.date).getFullYear()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Times */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{t('tab.card.call')}</span>
            <span>{convertTimeToFormFormat(shootingDay.call_time)}</span>
          </div>
          {shootingDay.on_set && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t('tab.card.onSet')}</span>
              <span>{convertTimeToFormFormat(shootingDay.on_set)}</span>
            </div>
          )}
          {shootingDay.lunch_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t('tab.card.lunch')}</span>
              <span>{convertTimeToFormFormat(shootingDay.lunch_time)}</span>
            </div>
          )}
          {shootingDay.wrap_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t('tab.card.wrap')}</span>
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

        {/* Safety & Logistics */}
        {(shootingDay.parking_info || shootingDay.hospital_info) && (
          <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t('tab.card.safety')}
            </div>
            {shootingDay.parking_info && (
              <div>
                <span className="font-medium">{t('tab.card.parking')}</span>{' '}
                <span className="text-muted-foreground">{shootingDay.parking_info}</span>
              </div>
            )}
            {shootingDay.hospital_info && (
              <div>
                <span className="font-medium">{t('tab.card.hospital')}</span>{' '}
                <span className="text-muted-foreground">{shootingDay.hospital_info}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {tCommon('view')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/shooting-days/${shootingDay.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {tCommon('edit')}
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
