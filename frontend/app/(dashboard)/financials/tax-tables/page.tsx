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

export default function TaxTablesPage() {
  const { organizationId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

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
    if (!confirm(`Are you sure you want to delete tax table "${taxTableName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteTaxTable.mutateAsync(taxTableId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete tax table: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Tables</h1>
          <p className="text-muted-foreground">Loading tax tables...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Tables</h1>
          <p className="text-destructive">Failed to load tax tables. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Tables</h1>
          <p className="text-muted-foreground">
            Configure tax rates for Brazilian tax compliance
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/tax-tables/new">
            <Plus className="mr-2 h-4 w-4" />
            New Tax Table
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Tax Tables</CardTitle>
          <CardDescription>
            Find tax tables by name or type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or type..."
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
              Show inactive tax tables
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
                {allTaxTables && allTaxTables.length > 0 ? 'No tax tables found' : 'No tax tables yet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allTaxTables && allTaxTables.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first tax table'}
              </p>
              {(!allTaxTables || allTaxTables.length === 0) && (
                <Button asChild>
                  <Link href="/financials/tax-tables/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Tax Table
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
                    <span className="text-sm text-muted-foreground">Rate:</span>
                    <span className="text-lg font-semibold">{taxTable.rate_percentage}%</span>
                  </div>

                  {taxTable.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {taxTable.description}
                    </p>
                  )}

                  <div className="flex items-center">
                    {taxTable.is_active ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/financials/tax-tables/${taxTable.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTaxTable(taxTable.id, taxTable.name)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
                Showing {filteredTaxTables.length} of {allTaxTables.length} tax table{allTaxTables.length !== 1 ? 's' : ''}
              </span>
              <span>
                {allTaxTables.filter(t => t.is_active).length} active • {allTaxTables.filter(t => !t.is_active).length} inactive
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
