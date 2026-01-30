'use client'

import { useState } from 'react'
import { useInventoryItems, useDeleteInventoryItem } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Box, Eye, AlertCircle, CheckCircle, Settings as Tool } from 'lucide-react'
import Link from 'next/link'
import { KitItem, HealthStatus } from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { useTranslations } from 'next-intl'

export default function InventoryItemsPage() {
  const { organizationId } = useAuth()
  const t = useTranslations('inventory.items')
  const [searchQuery, setSearchQuery] = useState('')
  const [healthFilter, setHealthFilter] = useState<HealthStatus | 'all'>('all')

  const { data: items, isLoading, error } = useInventoryItems(
    organizationId || '',
    undefined, // kit_id
    undefined, // category
    healthFilter === 'all' ? undefined : healthFilter
  )
  const deleteItem = useDeleteInventoryItem()

  const filteredItems = items?.filter(item => {
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  }) || []

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete,
    additionalData: itemName
  } = useConfirmDelete()

  const handleDeleteItem = async () => {
    if (!idToDelete) return
    try {
      await deleteItem.mutateAsync(idToDelete)
      cancelDelete()
    } catch (err) {
      cancelDelete()
      showError(err, t('delete.error'))
    }
  }

  const getHealthBadge = (status: HealthStatus) => {
    switch (status) {
      case 'excellent':
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> {t('health.excellent')}</Badge>
      case 'good':
        return <Badge variant="info"><CheckCircle className="w-3 h-3 mr-1" /> {t('health.good')}</Badge>
      case 'needs_service':
        return <Badge variant="warning"><AlertCircle className="w-3 h-3 mr-1" /> {t('health.needs_service')}</Badge>
      case 'broken':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> {t('health.broken')}</Badge>
      case 'retired':
        return <Badge variant="secondary">{t('health.retired')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/kits">
              {t('viewKits')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/items/new">
              <Plus className="mr-2 h-4 w-4" /> {t('newItem')}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={healthFilter} onValueChange={(v) => setHealthFilter(v as HealthStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('filters.healthPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allHealthStatuses')}</SelectItem>
                <SelectItem value="excellent">{t('health.excellent')}</SelectItem>
                <SelectItem value="good">{t('health.good')}</SelectItem>
                <SelectItem value="needs_service">{t('health.needs_service')}</SelectItem>
                <SelectItem value="broken">{t('health.broken')}</SelectItem>
                <SelectItem value="retired">{t('health.retired')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end h-10">
              <p className="text-sm font-medium">{t('filters.itemsFound', { count: filteredItems.length })}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div>{t('loading')}</div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>{item.category}</CardDescription>
                  </div>
                  {getHealthBadge(item.health_status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-1">
                  {item.serial_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('card.serialNumber')}</span>
                      <span className="font-mono">{item.serial_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('card.usage')}</span>
                    <span>{item.current_usage_hours.toFixed(1)} / {item.max_usage_hours} hrs</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/items/${item.id}`}>
                      <Eye className="mr-2 h-3 w-3" /> {t('card.view')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/items/${item.id}/edit`}>
                      <Edit className="mr-2 h-3 w-3" /> {t('card.edit')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDelete(item.id, item.name)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Box className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t('empty.title')}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('empty.description')}</p>
            <Button asChild>
              <Link href="/inventory/items/new">
                <Plus className="mr-2 h-4 w-4" /> {t('empty.addFirst')}
              </Link>
            </Button>
          </CardContent>
        </Card>

      )
      }

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
        onConfirm={handleDeleteItem}
        title={t('delete.title', { name: itemName || '' })}
        description={t('delete.description', { name: itemName || '' })}
        loading={deleteItem.isPending}
      />
    </div >
  )
}
