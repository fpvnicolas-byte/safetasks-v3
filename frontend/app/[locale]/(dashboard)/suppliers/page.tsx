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

export default function SuppliersPage() {
  const { organizationId } = useAuth()
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

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    if (!confirm(`Are you sure you want to delete "${supplierName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteSupplier.mutateAsync(supplierId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete supplier: ${error.message}`)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage vendors, rental houses, and service providers
          </p>
        </div>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="mr-2 h-4 w-4" />
            New Supplier
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Suppliers</CardTitle>
          <CardDescription>
            Find suppliers by name, category, or contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as SupplierCategory | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="rental_house">Rental House</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="catering">Catering</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="post_production">Post Production</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={activeOnly ? 'active' : 'all'} onValueChange={(value) => setActiveOnly(value === 'active')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="all">All Suppliers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Results</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div>Loading suppliers...</div>
      ) : error ? (
        <div>Error loading suppliers: {error.message}</div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onDelete={() => handleDeleteSupplier(supplier.id, supplier.name)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Suppliers Found</CardTitle>
            <CardDescription>
              {searchQuery || categoryFilter !== 'all'
                ? 'No suppliers match your current filters'
                : 'Get started by adding your first supplier'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Suppliers help you track vendors, freelancers, and service providers
              </p>
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Supplier
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
}

function SupplierCard({ supplier, onDelete }: SupplierCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {supplier.name}
              {!supplier.is_active && (
                <Badge variant="outline" className="text-xs">Inactive</Badge>
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

      <CardContent className="space-y-4">
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
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">Transaction Summary</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm">{supplier.total_transactions} transaction{supplier.total_transactions !== 1 ? 's' : ''}</span>
              <span className="text-lg font-semibold">{formatCurrency(supplier.total_amount_cents)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/suppliers/${supplier.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
