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

export default function InventoryItemsPage() {
  const { organizationId } = useAuth()
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await deleteItem.mutateAsync(id)
    } catch (err) {
      console.error('Failed to delete item:', err)
      alert('Failed to delete item')
    }
  }

  const getHealthBadge = (status: HealthStatus) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Excellent</Badge>
      case 'good':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><CheckCircle className="w-3 h-3 mr-1" /> Good</Badge>
      case 'needs_service':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black"><AlertCircle className="w-3 h-3 mr-1" /> Service Needed</Badge>
      case 'broken':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Broken</Badge>
      case 'retired':
        return <Badge variant="secondary">Retired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">Manage individual equipment assets and their health status</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/kits">
              View Kits
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/items/new">
              <Plus className="mr-2 h-4 w-4" /> New Item
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, serial, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={healthFilter} onValueChange={(v) => setHealthFilter(v as HealthStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health Statuses</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="needs_service">Needs Service</SelectItem>
                <SelectItem value="broken">Broken</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end h-10">
              <p className="text-sm font-medium">{filteredItems.length} items found</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div>Loading inventory...</div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
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
                      <span className="text-muted-foreground">S/N:</span>
                      <span className="font-mono">{item.serial_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usage:</span>
                    <span>{item.current_usage_hours.toFixed(1)} / {item.max_usage_hours} hrs</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/items/${item.id}`}>
                      <Eye className="mr-2 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/items/${item.id}/edit`}>
                      <Edit className="mr-2 h-3 w-3" /> Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id, item.name)}
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
            <Box className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm text-muted-foreground mb-4">Start by adding your first equipment item to the inventory</p>
            <Button asChild>
              <Link href="/inventory/items/new">
                <Plus className="mr-2 h-4 w-4" /> Add First Item
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
