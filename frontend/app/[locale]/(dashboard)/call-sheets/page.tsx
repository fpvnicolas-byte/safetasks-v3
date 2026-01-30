'use client'

import { useState, Suspense } from 'react'
import { useCallSheets, useDeleteCallSheet } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, FileText, Search, Edit, Trash2, Calendar, Clock, MapPin, Eye, CloudRain } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CallSheet, convertTimeToFormFormat } from '@/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'

function CallSheetsContent() {
  const { organizationId } = useAuth()
  const t = useTranslations('callSheets')
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')
  const [searchQuery, setSearchQuery] = useState('')

  // Get all call sheets (no project filter initially)
  const { data: allCallSheets, isLoading, error } = useCallSheets(organizationId || '', undefined)
  const deleteCallSheet = useDeleteCallSheet(organizationId || '')

  // Apply search filter
  const filteredCallSheets = allCallSheets?.filter(sheet => {
    const matchesSearch = !searchQuery ||
      sheet.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.project?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.notes?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  }) || []

  // Sort by shooting day (most recent first)
  const sortedCallSheets = [...filteredCallSheets].sort((a, b) =>
    new Date(b.shooting_day).getTime() - new Date(a.shooting_day).getTime()
  )

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete
  } = useConfirmDelete()

  const handleDeleteCallSheet = async () => {
    if (!idToDelete) return

    try {
      await deleteCallSheet.mutateAsync(idToDelete)
      cancelDelete()
    } catch (err: unknown) {
      cancelDelete()
      showError(err, t('tab.error', { message: '' }).split(':')[0])
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('tab.description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/call-sheets/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newCallSheet')}
          </Link>
        </Button>
      </div>

      {/* Search Filter */}
      <Card>
        <CardHeader>
          <CardTitle>{tCommon('search')}</CardTitle>
          <CardDescription>
            {t('tab.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tCommon('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-center h-10 px-4 bg-muted rounded-md">
              <span className="text-sm font-medium">
                {sortedCallSheets.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Sheets Grid */}
      {isLoading ? (
        <div>{t('tab.loading')}</div>
      ) : error ? (
        <div>{t('tab.error', { message: error.message })}</div>
      ) : sortedCallSheets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedCallSheets.map((sheet) => (
            <CallSheetCard
              key={sheet.id}
              callSheet={sheet}
              onDelete={() => confirmDelete(sheet.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('tab.empty.title')}</CardTitle>
            <CardDescription>
              {searchQuery
                ? t('noCallSheets')
                : t('tab.empty.description')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('tab.empty.help')}
              </p>
              <Button asChild>
                <Link href="/call-sheets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('tab.empty.action')}
                </Link>
              </Button>
            </div>
          </CardContent>
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
        onConfirm={handleDeleteCallSheet}
        title={t('tab.deleteConfirm')}
        description={tFeedback('confirmDelete')}
        loading={deleteCallSheet.isPending}
      />
    </div>
  )
}

interface CallSheetCardProps {
  callSheet: CallSheet
  onDelete: () => void
}

function CallSheetCard({ callSheet, onDelete }: CallSheetCardProps) {
  const t = useTranslations('callSheets')
  const tCommon = useTranslations('common')

  const formattedDate = new Date(callSheet.shooting_day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <Link href={`/projects/${callSheet.project_id}`} className="flex-1 cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {formattedDate}
              </CardTitle>
              {callSheet.project && (
                <div className="mt-1">
                  <p className="text-sm font-semibold text-primary">{callSheet.project.title}</p>
                  {callSheet.project.client && (
                    <p className="text-xs text-muted-foreground">{callSheet.project.client.name}</p>
                  )}
                </div>
              )}
            </div>
            <Badge variant={
              callSheet.status === 'confirmed' ? 'default' :
                callSheet.status === 'completed' ? 'secondary' : 'outline'
            }>
              {t(`detail.status.${callSheet.status}`)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-2">
          <div className="space-y-1">
            <p className="font-medium text-sm">{callSheet.location}</p>
            {callSheet.location_address && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5" />
                <span className="line-clamp-1">{callSheet.location_address}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{t('tab.card.crewCall')}: {convertTimeToFormFormat(callSheet.crew_call)}</span>
            </div>
            {callSheet.on_set && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{t('tab.card.onSet')}: {convertTimeToFormFormat(callSheet.on_set)}</span>
              </div>
            )}
          </div>
          {callSheet.weather && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CloudRain className="h-3 w-3" />
              <span className="line-clamp-1">{callSheet.weather}</span>
            </div>
          )}
        </CardContent>
      </Link>

      <div className="p-6 pt-0 mt-auto">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/call-sheets/${callSheet.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {tCommon('view')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/call-sheets/${callSheet.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {tCommon('edit')}
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

export default function CallSheetsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallSheetsContent />
    </Suspense>
  )
}
