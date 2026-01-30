'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallSheet } from '@/lib/api/hooks'
import { apiClient } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Edit, Trash2, Clock, MapPin, Cloud, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatTime } from '@/lib/utils/time'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
}

export default function CallSheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const callSheetId = params.id as string
  const t = useTranslations('callSheets.detail')
  const tCommon = useTranslations('common')

  const { data: callSheet, isLoading, error } = useCallSheet(callSheetId)
  const queryClient = useQueryClient()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete
  } = useConfirmDelete()

  async function handleDelete() {
    try {
      await apiClient.delete(`/call-sheets/${callSheetId}`)
      // Invalidate and refetch call sheets for the project
      queryClient.invalidateQueries({ queryKey: ['callSheets', callSheet?.project_id] })
      router.push(`/${locale}/projects/${callSheet?.project_id}?tab=call-sheets`)
    } catch (err: unknown) {
      const error = err as Error
      setDeleteError(error.message || t('deleteError'))
      cancelDelete()
    }
  }

  const requestDelete = () => {
    confirmDelete(callSheetId)
  }

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (error) {
    return <div>{t('error', { message: error.message })}</div>
  }

  if (!callSheet) {
    return <div>{t('notFound')}</div>
  }

  const shootDate = new Date(callSheet.shooting_day).toLocaleDateString(locale, {
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
            {t('title')} - {callSheet.project_id}
          </h1>
          <p className="text-muted-foreground">
            {shootDate} • {callSheet.location}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/call-sheets/${callSheetId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              {tCommon('edit')}
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={requestDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={t('deleteConfirm')}
        loading={false}
      />

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={statusColors[callSheet.status]}>
          {t(`status.${callSheet.status}`)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('created')} {new Date(callSheet.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Call Times */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('callTimes')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('crewCall')}:</span>
              <span className="text-lg">{formatTime(callSheet.crew_call)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">{t('onSet')}:</span>
              <span className="text-lg">{formatTime(callSheet.on_set)}</span>
            </div>
            {callSheet.lunch_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('lunch')}:</span>
                <span>{formatTime(callSheet.lunch_time)}</span>
              </div>
            )}
            {callSheet.wrap_time && (
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('wrap')}:</span>
                <span>{formatTime(callSheet.wrap_time)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('location')}
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
            {callSheet.weather && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  <span className="text-sm">{callSheet.weather}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Emergency Information */}
      {callSheet.hospital_info && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">
              🚨 {t('emergencyInfo')}
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
              {t('productionNotes')}
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
