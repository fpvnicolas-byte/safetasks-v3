'use client'

import { useState } from 'react'
import { useCallSheets, useDeleteCallSheet } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Edit, Trash2, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { formatTime } from '@/lib/utils/time'
import { CallSheet } from '@/types'

interface CallSheetsTabProps {
  projectId: string
}

export function CallSheetsTab({ projectId }: CallSheetsTabProps) {
  const { organizationId } = useAuth()
  const { data: callSheets, isLoading, error } = useCallSheets(organizationId || '', projectId)
  const deleteCallSheet = useDeleteCallSheet(organizationId || '')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const t = useTranslations('callSheets')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  async function handleDelete(callSheetId: string) {
    if (!confirm(t('tab.deleteConfirm'))) {
      return
    }

    try {
      setDeletingId(callSheetId)
      await deleteCallSheet.mutateAsync(callSheetId)
    } catch (err: unknown) {
      console.error('Failed to delete call sheet:', err)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('tab.description')}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/call-sheets/new?project=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newCallSheet')}
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
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('tab.empty.help')}
              </p>
              <Button asChild>
                <Link href={`/call-sheets/new?project=${projectId}`}>
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

interface CallSheetCardProps {
  callSheet: CallSheet
  onDelete: (callSheetId: string) => void
  isDeleting: boolean
  t: (key: string) => string
  tCommon: (key: string) => string
  locale: string
}

function CallSheetCard({ callSheet, onDelete, isDeleting, t, tCommon, locale }: CallSheetCardProps) {
  const shootDate = new Date(callSheet.shooting_day).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{t('tab.card.title')}</CardTitle>
            <CardDescription>{shootDate}</CardDescription>
          </div>
          <Badge variant={callSheet.status === 'confirmed' ? 'default' : 'secondary'}>
            {callSheet.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Location */}
        {callSheet.location && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{callSheet.location}</div>
              {callSheet.location_address && (
                <div className="text-sm text-muted-foreground">{callSheet.location_address}</div>
              )}
            </div>
          </div>
        )}

        {/* Call Times */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {callSheet.crew_call && (
            <div>
              <div className="font-medium text-muted-foreground">{t('tab.card.crewCall')}</div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(callSheet.crew_call)}
              </div>
            </div>
          )}
          {callSheet.on_set && (
            <div>
              <div className="font-medium text-muted-foreground">{t('tab.card.onSet')}</div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(callSheet.on_set)}
              </div>
            </div>
          )}
        </div>

        {/* Weather */}
        {callSheet.weather && (
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">{t('tab.card.weather')} </span>
            {callSheet.weather}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/call-sheets/${callSheet.id}`}>
              <Edit className="mr-2 h-3 w-3" />
              {tCommon('view')}
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
