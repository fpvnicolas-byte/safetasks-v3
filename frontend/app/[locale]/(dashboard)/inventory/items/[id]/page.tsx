'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useInventoryItem, useDeleteInventoryItem } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft, CheckCircle, AlertCircle, Calendar, Clock, Activity, FileText, Info, Plus, Settings as Tool } from 'lucide-react'
import Link from 'next/link'
import { HealthStatus, formatCurrency } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function InventoryItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const itemId = params.id as string

  const { data: item, isLoading, error } = useInventoryItem(itemId)
  const deleteItem = useDeleteInventoryItem()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const t = useTranslations('inventory.items')
  const tCommon = useTranslations('common.feedback')

  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete
  } = useConfirmDelete()

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon('error')}</AlertTitle>
          <AlertDescription>{t('notFound')}</AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={() => router.push(`/${locale}/inventory/items`)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('back')}
        </Button>
      </div>
    )
  }



  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(itemId)
      router.push(`/${locale}/inventory/items`)
    } catch (err: unknown) {
      console.error('Failed to delete item:', err)
      cancelDelete()
      alert(tCommon('actionError', { message: err.message || 'Unknown error' }))
    }
  }

  const requestDelete = () => {
    confirmDelete(itemId)
  }

  const getHealthBadge = (status: HealthStatus) => {
    switch (status) {
      case 'excellent':
        return <Badge variant="success" className="px-3 py-1"><CheckCircle className="w-3 h-3 mr-1" /> Excellent</Badge>
      case 'good':
        return <Badge variant="info" className="px-3 py-1"><CheckCircle className="w-3 h-3 mr-1" /> Good</Badge>
      case 'needs_service':
        return <Badge variant="warning" className="px-3 py-1"><AlertCircle className="w-3 h-3 mr-1" /> Service Needed</Badge>
      case 'broken':
        return <Badge variant="destructive" className="px-3 py-1"><AlertCircle className="w-3 h-3 mr-1" /> Broken</Badge>
      case 'retired':
        return <Badge variant="secondary" className="px-3 py-1">Retired</Badge>
      default:
        return <Badge variant="outline" className="px-3 py-1">{status}</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory/items')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{item.name}</h1>
            <p className="text-muted-foreground">{item.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/inventory/items/${itemId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={requestDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {getHealthBadge(item.health_status)}
        {item.maintenance_overdue && (
          <Badge variant="destructive" className="animate-pulse">
            Maintenance Overdue
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Info className="h-5 w-5 text-muted-foreground" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Serial Number</div>
                <div className="text-base font-mono mt-1">{item.serial_number || 'N/A'}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Category</div>
                <div className="text-base mt-1 capitalize">{item.category}</div>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <div className="font-medium text-muted-foreground">Description</div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{item.description || 'No description provided.'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Usage & Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Usage</span>
                <span className="font-semibold">{item.current_usage_hours.toFixed(1)} / {item.max_usage_hours} hours</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.current_usage_hours / item.max_usage_hours > 0.9 ? 'bg-destructive' : 'bg-info'}`}
                  style={{ width: `${Math.min((item.current_usage_hours / item.max_usage_hours) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
              <div>
                <div className="text-muted-foreground">Maintenance Interval</div>
                <div className="font-medium mt-1">{item.maintenance_interval_hours} hours</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Maintenance</div>
                <div className="font-medium mt-1">
                  {item.last_maintenance_date ? new Date(item.last_maintenance_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                </div>
              </div>
              {item.days_since_last_maintenance !== null && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Days Since Last Service</div>
                  <div className="font-medium mt-1">{item.days_since_last_maintenance} days</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Purchase & Financials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Purchase Date</div>
                <div className="mt-1">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Purchase Cost</div>
                <div className="mt-1 font-semibold">
                  {item.purchase_cost_cents ? formatCurrency(item.purchase_cost_cents) : 'N/A'}
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <div className="font-medium text-muted-foreground">Warranty Expiry</div>
                <div className="mt-1 flex items-center">
                  {item.warranty_expiry ? (
                    <>
                      {new Date(item.warranty_expiry).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {new Date(item.warranty_expiry) < new Date() && (
                        <Badge variant="destructive" className="ml-2 text-[10px] h-4">Expired</Badge>
                      )}
                    </>
                  ) : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {item.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Internal Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-wrap italic text-muted-foreground">{item.notes}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Maintenance & Activity Logs</CardTitle>
            <CardDescription>Track service history and significant events</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Log Service
          </Button>
        </CardHeader>
        <CardContent>
          {item.maintenance_count > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-info" />
                  <div>
                    <div className="text-sm font-medium">Last maintenance performed</div>
                    <div className="text-xs text-muted-foreground">
                      Type: {item.last_maintenance_type || 'N/A'}
                    </div>
                  </div>
                </div>
                <Button variant="link" size="sm" asChild>
                  <Link href={`/inventory/items/${itemId}/history`}>View Full History</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-center">
              <Tool className="h-10 w-10 text-muted-foreground opacity-20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">No maintenance history recorded for this item.</p>
              <p className="text-xs text-muted-foreground mt-1">Logging service helps maintain equipment longevity and resale value.</p>
            </div>
          )}
        </CardContent>
      </Card>


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
        onConfirm={handleDelete}
        title="Delete Item?"
        description={tCommon('confirmDelete')}
        loading={deleteItem.isPending}
      />
    </div >
  )
}
