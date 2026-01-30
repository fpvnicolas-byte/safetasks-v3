'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateKit, useInventoryItems, useUpdateInventoryItem } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { KitCreate, KitStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Package, Search, AlertCircle } from 'lucide-react'

export default function NewKitPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const createKit = useCreateKit()
  const { data: allItems, isLoading: itemsLoading } = useInventoryItems(organizationId || '')
  const updateItem = useUpdateInventoryItem()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const kitData: KitCreate = {
        name: (formData.get('name') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        category: (formData.get('category') as string || '').trim() || undefined,
        status: (formData.get('status') as KitStatus) || 'available',
      }

      const newKit = await createKit.mutateAsync(kitData)

      // Update selected items to use this new kit_id
      if (selectedItems.length > 0) {
        await Promise.all(
          selectedItems.map(itemId =>
            updateItem.mutateAsync({ itemId, data: { kit_id: newKit.id } })
          )
        )
      }

      router.push('/inventory/kits')
    } catch (err: any) {
      console.error('Create kit error:', err)
      showError(err, 'Error Creating Kit')
    }
  }

  const filteredItems = allItems?.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Kit</CardTitle>
            <CardDescription>A kit is a collection of equipment items (e.g., &quot;DJI Inspire 3 Production Kit&quot;)</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Kit Name *</Label>
                <Input id="name" name="name" placeholder="e.g., Primary Drone Kit, Camera A-Rig" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g., Drone, Camera, Lighting" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select name="status" defaultValue="available">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_use">In Use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="List the contents or purpose of this kit..." rows={3} />
              </div>
            </div>

            {/* Kit Builder Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Kit Builder</h3>
                <p className="text-sm text-muted-foreground">Select existing items to move into this kit</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                {itemsLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading items...</div>
                ) : filteredItems.length > 0 ? (
                  <div className="divide-y">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems([...selectedItems, item.id])
                            } else {
                              setSelectedItems(selectedItems.filter(id => id !== item.id))
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <label htmlFor={`item-${item.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer block">
                            {item.name}
                          </label>
                          <p className="text-xs text-muted-foreground truncate">{item.category} • S/N: {item.serial_number || 'N/A'}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Currently in another kit
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">No items available to add.</p>
                  </div>
                )}
              </div>
              {selectedItems.length > 0 && (
                <p className="text-xs text-info font-medium">
                  {selectedItems.length} item(s) will be reassigned to this new kit.
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={createKit.isPending}>
              {createKit.isPending ? 'Creating...' : 'Create Kit & Assign Items'}
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
