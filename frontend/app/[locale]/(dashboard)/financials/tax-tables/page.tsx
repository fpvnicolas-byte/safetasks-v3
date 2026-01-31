'use client'

import { useState } from 'react'
import { useTaxTables, useDeleteTaxTable } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, FileText } from 'lucide-react'
import Link from 'next/link'
import { getTaxTypeDisplayName } from '@/types'
import { useTranslations } from 'next-intl'

export default function TaxTablesPage() {
  const { organizationId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const t = useTranslations('financials.pages.taxTables')
  const tCommon = useTranslations('common')

  const { data: allTaxTables, isLoading, error } = useTaxTables(
    organizationId || '',
    !showInactive
  )
  const deleteTaxTable = useDeleteTaxTable()

  const filteredTaxTables = allTaxTables?.filter(taxTable => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      taxTable.name.toLowerCase().includes(searchLower) ||
      taxTable.tax_type.toLowerCase().includes(searchLower)
    )
  }) || []

  const handleDeleteTaxTable = async (taxTableId: string, taxTableName: string) => {
    if (!confirm(t('deleteConfirm', { name: taxTableName }))) {
      return
    }

    try {
      await deleteTaxTable.mutateAsync(taxTableId)
    } catch (err: unknown) {
      const error = err as Error
      alert(t('deleteError', { message: error.message }))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-destructive">{t('error')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/tax-tables/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.new')}
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('search.title')}</CardTitle>
          <CardDescription>
            {t('search.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showInactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="showInactive" className="text-sm">
              {t('search.showInactive')}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Tax Tables List */}
      {filteredTaxTables.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {allTaxTables && allTaxTables.length > 0
                  ? t('empty.filteredTitle')
                  : t('empty.noTablesTitle')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allTaxTables && allTaxTables.length > 0
                  ? t('empty.filteredDescription')
                  : t('empty.noTablesDescription')}
              </p>
              {(!allTaxTables || allTaxTables.length === 0) && (
                <Button asChild>
                  <Link href="/financials/tax-tables/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.addFirst')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTaxTables.map((taxTable) => (
            <Card key={taxTable.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{taxTable.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {getTaxTypeDisplayName(taxTable.tax_type)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('list.rate')}</span>
                    <span className="text-lg font-semibold">{taxTable.rate_percentage}%</span>
                  </div>

                  {taxTable.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {taxTable.description}
                    </p>
                  )}

                  <div className="flex items-center">
                    {taxTable.is_active ? (
                      <Badge variant="success">{t('status.active')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('status.inactive')}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/financials/tax-tables/${taxTable.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      {tCommon('edit')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTaxTable(taxTable.id, taxTable.name)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {allTaxTables && allTaxTables.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('summary.showing', { filtered: filteredTaxTables.length, total: allTaxTables.length })}
              </span>
              <span>
                {t('summary.statusCounts', {
                  active: allTaxTables.filter(t => t.is_active).length,
                  inactive: allTaxTables.filter(t => !t.is_active).length
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
