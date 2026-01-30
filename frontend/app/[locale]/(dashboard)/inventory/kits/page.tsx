'use client'

import { useKits, useDeleteKit } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Package, Edit, Trash2, Eye, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Kit, KitStatus } from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { useTranslations } from 'next-intl'

export default function KitsPage() {
  const { organizationId } = useAuth()
  const t = useTranslations('inventory.kits')
  const { data: kits, isLoading, error } = useKits(organizationId || '')
  const deleteKit = useDeleteKit()

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete,
    additionalData: kitName
  } = useConfirmDelete()

  const handleDeleteKit = async () => {
    if (!idToDelete) return
    try {
      await deleteKit.mutateAsync(idToDelete)
      cancelDelete()
    } catch (err) {
      cancelDelete()
      showError(err, t('delete.error'))
    }
  }

  const getStatusBadge = (status: KitStatus) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">{t('status.available')}</Badge>
      case 'in_use':
        return <Badge className="bg-blue-500">{t('status.in_use')}</Badge>
      case 'maintenance':
        return <Badge variant="destructive">{t('status.maintenance')}</Badge>
      case 'retired':
        return <Badge variant="secondary">{t('status.retired')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/items">
              {t('viewAllItems')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/kits/new">
              <Plus className="mr-2 h-4 w-4" /> {t('newKit')}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div>{t('loading')}</div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : kits && kits.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <Card key={kit.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{kit.name}</CardTitle>
                    <CardDescription>{kit.category || t('card.noCategory')}</CardDescription>
                  </div>
                  {getStatusBadge(kit.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {kit.description || t('card.noDescription')}
                </p>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/kits/${kit.id}`}>
                      <Eye className="mr-2 h-3 w-3" /> {t('card.view')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/kits/${kit.id}/edit`}>
                      <Edit className="mr-2 h-3 w-3" /> {t('card.edit')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDelete(kit.id, kit.name)}
                    className="text-destructive hover:text-destructive"
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
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t('empty.title')}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('empty.description')}</p>
            <Button asChild>
              <Link href="/inventory/kits/new">
                <Plus className="mr-2 h-4 w-4" /> {t('empty.createFirst')}
              </Link>
            </Button>
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
        onConfirm={handleDeleteKit}
        title={t('delete.title', { name: kitName || '' })}
        description={t('delete.description', { name: kitName || '' })}
        loading={deleteKit.isPending}
      />
    </div>
  )
}
