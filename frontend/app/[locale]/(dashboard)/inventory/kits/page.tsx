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

export default function KitsPage() {
  const { organizationId } = useAuth()
  const { data: kits, isLoading, error } = useKits(organizationId || '')
  const deleteKit = useDeleteKit()

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete kit "${name}"? Items inside the kit will NOT be deleted.`)) return
    try {
      await deleteKit.mutateAsync(id)
    } catch (err) {
      console.error('Failed to delete kit:', err)
      alert('Failed to delete kit')
    }
  }

  const getStatusBadge = (status: KitStatus) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">Available</Badge>
      case 'in_use':
        return <Badge className="bg-blue-500">In Use</Badge>
      case 'maintenance':
        return <Badge variant="destructive">Maintenance</Badge>
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
          <h1 className="text-3xl font-bold tracking-tight">Equipment Kits</h1>
          <p className="text-muted-foreground">Manage collections of equipment for specific shooting needs</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/items">
              View All Items
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/kits/new">
              <Plus className="mr-2 h-4 w-4" /> New Kit
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div>Loading kits...</div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
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
                    <CardDescription>{kit.category || 'No category'}</CardDescription>
                  </div>
                  {getStatusBadge(kit.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {kit.description || 'No description provided.'}
                </p>

                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/kits/${kit.id}`}>
                      <Eye className="mr-2 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/inventory/kits/${kit.id}/edit`}>
                      <Edit className="mr-2 h-3 w-3" /> Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(kit.id, kit.name)}
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
            <p className="text-lg font-medium">No kits found</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first equipment kit (e.g., &quot;Standard Drone Kit&quot;)</p>
            <Button asChild>
              <Link href="/inventory/kits/new">
                <Plus className="mr-2 h-4 w-4" /> Create First Kit
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
