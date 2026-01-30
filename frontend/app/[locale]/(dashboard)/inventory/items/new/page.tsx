'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCreateInventoryItem, useKits } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { KitItemCreate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { AlertCircle } from 'lucide-react'

export default function NewInventoryItemPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedKitId, setSelectedKitId] = useState<string>('')

  const { data: kits, isLoading: kitsLoading } = useKits(organizationId || '')
  const createItem = useCreateInventoryItem()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedKitId) {
      showError({ message: 'Please select a kit to assign this item to' }, 'Validation Error')
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
      const data: KitItemCreate = {
        kit_id: selectedKitId,
        name: (formData.get('name') as string).trim(),
        category: (formData.get('category') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        serial_number: (formData.get('serial_number') as string || '').trim() || undefined,
        purchase_date: (formData.get('purchase_date') as string) || undefined,
        purchase_cost_cents: formData.get('purchase_cost') ? Math.round(parseFloat(formData.get('purchase_cost') as string) * 100) : undefined,
        warranty_expiry: (formData.get('warranty_expiry') as string) || undefined,
        maintenance_interval_hours: parseFloat(formData.get('maintenance_interval') as string) || 50,
        max_usage_hours: parseFloat(formData.get('max_usage') as string) || 1000,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await createItem.mutateAsync(data)
      router.push('/inventory/items')
    } catch (err: any) {
      console.error('Create item error:', err)
      showError(err, 'Error Creating Item')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Add New Equipment Item</CardTitle>
            <CardDescription>Add a new piece of equipment to your inventory</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input id="name" name="name" placeholder="e.g., DJI Mavic 3 Pro, Sony A7S III" required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input id="category" name="category" placeholder="e.g., drone, camera, lens" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kit">Assign to Kit *</Label>
                  {kitsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading kits...</div>
                  ) : kits && kits.length > 0 ? (
                    <Select value={selectedKitId} onValueChange={setSelectedKitId} required>
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
                      <p className="text-xs text-muted-foreground">No kits found. Items must belong to a kit.</p>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/inventory/kits/new">Create Kit First</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Brief details about the item..." rows={2} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number</Label>
                <Input id="serial_number" name="serial_number" placeholder="Manufacturer's S/N" />
              </div>
            </div>

            {/* Lifecycle */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Lifecycle & Maintenance</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maintenance_interval">Maintenance Interval (Hours)</Label>
                  <Input id="maintenance_interval" name="maintenance_interval" type="number" step="0.5" defaultValue="50" required />
                  <p className="text-xs text-muted-foreground">Hours of use before maintenance alert</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_usage">Max Usage Life (Hours)</Label>
                  <Input id="max_usage" name="max_usage" type="number" step="1" defaultValue="1000" required />
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
                  <Input id="purchase_date" name="purchase_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost">Purchase Cost</Label>
                  <Input id="purchase_cost" name="purchase_cost" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input id="warranty_expiry" name="warranty_expiry" type="date" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" placeholder="Additional notes..." rows={3} />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createItem.isPending || !selectedKitId}>
              {createItem.isPending ? 'Creating...' : 'Create Item'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}
