'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSupplier, useUpdateSupplier } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { SupplierUpdate, SupplierCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { Switch } from '@/components/ui/switch'

export default function EditSupplierPage() {
  const router = useRouter()
  const params = useParams()
  const { organizationId } = useAuth()
  const supplierId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory>('rental_house')
  const [isActive, setIsActive] = useState(true)

  const { data: supplier, isLoading } = useSupplier(supplierId, organizationId || undefined)
  const updateSupplier = useUpdateSupplier()

  // Initialize state when supplier loads
  if (supplier && selectedCategory !== supplier.category) {
    setSelectedCategory(supplier.category)
  }
  if (supplier && isActive !== supplier.is_active) {
    setIsActive(supplier.is_active)
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Supplier</CardTitle>
            <CardDescription>Update supplier details</CardDescription>
          </CardHeader>
          <CardContent>
            <div>Loading supplier...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!supplier) {
    return <div className="p-8 text-destructive">Supplier not found</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const specialtiesInput = formData.get('specialties') as string
      const specialties = specialtiesInput
        ? specialtiesInput.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const data: SupplierUpdate = {
        name: (formData.get('name') as string).trim(),
        category: selectedCategory,
        document_id: (formData.get('document_id') as string || '').trim() || undefined,
        email: (formData.get('email') as string || '').trim() || undefined,
        phone: (formData.get('phone') as string || '').trim() || undefined,
        address: (formData.get('address') as string || '').trim() || undefined,
        specialties,
        notes: (formData.get('notes') as string || '').trim() || undefined,
        is_active: isActive,
      }

      await updateSupplier.mutateAsync({ supplierId, data })
      router.push(`/suppliers/${supplierId}`)
    } catch (err: unknown) {
      console.error('Update supplier error:', err)
      showError(err, 'Error Updating Supplier')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Supplier</CardTitle>
            <CardDescription>Update supplier details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active Status</Label>
                <div className="text-sm text-muted-foreground">
                  Inactive suppliers won&apos;t appear in default lists
                </div>
              </div>
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={supplier.name}
                  placeholder="e.g., ABC Camera Rentals"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as SupplierCategory)} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label htmlFor="document_id">Tax ID / Document Number</Label>
                <Input
                  id="document_id"
                  name="document_id"
                  defaultValue={supplier.document_id || ''}
                  placeholder="CPF/CNPJ or EIN"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={supplier.email || ''}
                    placeholder="contact@supplier.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={supplier.phone || ''}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={supplier.address || ''}
                  placeholder="Street address, city, state, postal code"
                  rows={2}
                />
              </div>
            </div>

            {/* Specialties & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>

              <div className="space-y-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  name="specialties"
                  defaultValue={supplier.specialties?.join(', ') || ''}
                  placeholder="Camera gear, lighting, drones (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">
                  Enter specialties separated by commas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={supplier.notes || ''}
                  placeholder="Additional notes, payment terms, or special instructions..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateSupplier.isPending}
            >
              {updateSupplier.isPending ? 'Saving...' : 'Save Changes'}
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
