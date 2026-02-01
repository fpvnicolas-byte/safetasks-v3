'use client'

import { useState } from 'react'
import { useSuppliers, useDeleteSupplier } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Briefcase, Eye, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { SupplierWithTransactions, SupplierCategory, getSupplierCategoryDisplayName, formatCurrency } from '@/types'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function SuppliersPage() {
  const { organizationId } = useAuth()
  const t = useTranslations('suppliers')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SupplierCategory | 'all'>('all')
  const [activeOnly, setActiveOnly] = useState(true)

  // Get suppliers data
  const { data: allSuppliers, isLoading, error } = useSuppliers(
    organizationId || '',
    categoryFilter === 'all' ? undefined : categoryFilter
  )
  const deleteSupplier = useDeleteSupplier()

  // Apply search filter
  const filteredSuppliers = allSuppliers?.filter(supplier => {
    const matchesSearch = !searchQuery ||
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.phone?.includes(searchQuery)

    return matchesSearch
  }) || []

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteSupplier = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteSupplier.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      alert(t('delete.error', { message: error.message }))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteSupplier}
        loading={isDeleting}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: deleteTarget?.name || '' })}
      />
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Procurement / Vendors
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newSupplier')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
          <CardDescription>
            {t('filters.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.category')}</label>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as SupplierCategory | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
                  <SelectItem value="rental_house">{t('filters.rentalHouse')}</SelectItem>
                  <SelectItem value="freelancer">{t('filters.freelancer')}</SelectItem>
                  <SelectItem value="catering">{t('filters.catering')}</SelectItem>
                  <SelectItem value="transport">{t('filters.transport')}</SelectItem>
                  <SelectItem value="post_production">{t('filters.postProduction')}</SelectItem>
                  <SelectItem value="other">{t('filters.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.status')}</label>
              <Select value={activeOnly ? 'active' : 'all'} onValueChange={(value) => setActiveOnly(value === 'active')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('filters.activeOnly')}</SelectItem>
                  <SelectItem value="all">{t('filters.allSuppliers')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.results')}</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredSuppliers.length !== 1 ? t('filters.supplierCount_other', { count: filteredSuppliers.length }) : t('filters.supplierCount', { count: 1 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div>{t('list.loading')}</div>
      ) : error ? (
        <div>{t('list.error', { message: error.message })}</div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onDelete={() => setDeleteTarget({ id: supplier.id, name: supplier.name })}
              t={t}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('empty.title')}</CardTitle>
            <CardDescription>
              {searchQuery || categoryFilter !== 'all'
                ? t('empty.noMatches')
                : t('empty.getStarted')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('empty.helpText')}
              </p>
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('empty.addFirst')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface SupplierCardProps {
  supplier: SupplierWithTransactions
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
}

function SupplierCard({ supplier, onDelete, t }: SupplierCardProps) {
  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="min-h-[96px]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2 line-clamp-1">
              {supplier.name}
              {!supplier.is_active && (
                <Badge variant="outline" className="text-xs">{t('card.inactive')}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              <Badge variant="secondary" className="mt-1">
                {getSupplierCategoryDisplayName(supplier.category)}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4">
        <div className="space-y-2 text-sm">
          {supplier.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{supplier.email}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{supplier.phone}</span>
            </div>
          )}
        </div>

        {supplier.total_transactions > 0 && (
          <div className="pt-2 border-t mt-auto">
            <div className="text-xs text-muted-foreground">{t('card.transactionSummary')}</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm">{supplier.total_transactions !== 1 ? t('card.transaction_other', { count: supplier.total_transactions }) : t('card.transaction', { count: 1 })}</span>
              <span className="text-lg font-semibold">{formatCurrency(supplier.total_amount_cents)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 mt-auto">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/suppliers/${supplier.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('list.view')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {t('list.edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
