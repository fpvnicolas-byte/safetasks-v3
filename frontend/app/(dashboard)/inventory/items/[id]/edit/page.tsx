'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useInventoryItem, useUpdateInventoryItem, useKits } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { KitItemUpdate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormSkeleton } from '@/components/LoadingSkeletons'

export default function EditInventoryItemPage() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.id as string
  const { organizationId } = useAuth()

  const [error, setError] = useState<string | null>(null)
  const { data: item, isLoading } = useInventoryItem(itemId)
  const { data: kits, isLoading: isLoadingKits } = useKits(organizationId || '')
  const updateItem = useUpdateInventoryItem()

  if (isLoading || isLoadingKits) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Equipment Item</CardTitle>
            <CardDescription>Update equipment details</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!item) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Equipment item not found</AlertDescription>
      </Alert>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const data: KitItemUpdate = {
        name: (formData.get('name') as string).trim(),
        category: (formData.get('category') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        serial_number: (formData.get('serial_number') as string || '').trim() || undefined,
        purchase_date: (formData.get('purchase_date') as string || '').trim() || undefined,
        purchase_cost_cents: formData.get('purchase_cost') ? Math.round(parseFloat(formData.get('purchase_cost') as string) * 100) : undefined,
        warranty_expiry: (formData.get('warranty_expiry') as string || '').trim() || undefined,
        maintenance_interval_hours: parseFloat(formData.get('maintenance_interval') as string) || 50,
        max_usage_hours: parseFloat(formData.get('max_usage') as string) || 1000,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await updateItem.mutateAsync({ itemId, data })
      router.push('/inventory/items')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to update equipment item')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Equipment Item</CardTitle>
            <CardDescription>Update equipment details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input id="name" name="name" defaultValue={item.name} placeholder="e.g., DJI Mavic 3 Pro, Sony A7S III" required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input id="category" name="category" defaultValue={item.category} placeholder="e.g., drone, camera, lens" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kit">Assigned Kit</Label>
                  {isLoadingKits ? (
                    <div className="text-sm text-muted-foreground">Loading kits...</div>
                  ) : kits && kits.length > 0 ? (
                    <Select name="kit_id" defaultValue={item.kit_id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a kit" />
                      </SelectTrigger>
                      <SelectContent>
                        {kits.map((kit) => (
                          <SelectItem key={kit.id} value={kit.id}>
                            {kit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">No kits available.</p>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/inventory/kits/new">Create Kit</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={item.description || ''} placeholder="Brief details about the item..." rows={2} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input id="serial_number" name="serial_number" defaultValue={item.serial_number || ''} placeholder="Manufacturer's S/N" />
              </div>
            </div>

            {/* Lifecycle */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Lifecycle & Maintenance</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maintenance_interval">Maintenance Interval (Hours)</Label>
                  <Input id="maintenance_interval" name="maintenance_interval" type="number" step="0.5" defaultValue={item.maintenance_interval_hours} required />
                  <p className="text-xs text-muted-foreground">Hours of use before maintenance alert</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_usage">Max Usage Life (Hours)</Label>
                  <Input id="max_usage" name="max_usage" type="number" step="1" defaultValue={item.max_usage_hours} required />
                  <p className="text-xs text-muted-foreground">Total estimated lifespan of the item</p>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Purchase Info</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input id="purchase_date" name="purchase_date" type="date" defaultValue={item.purchase_date || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost">Purchase Cost</Label>
                  <Input id="purchase_cost" name="purchase_cost" type="number" step="0.01" defaultValue={item.purchase_cost_cents ? (item.purchase_cost_cents / 100).toFixed(2) : ''} placeholder="0.00" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input id="warranty_expiry" name="warranty_expiry" type="date" defaultValue={item.warranty_expiry || ''} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={item.notes || ''} placeholder="Additional notes..." rows={3} />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={updateItem.isPending}>
              {updateItem.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}