'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateSupplier } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { SupplierCreate, SupplierCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function NewSupplierPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory>('rental_house')

  const createSupplier = useCreateSupplier()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const specialtiesInput = formData.get('specialties') as string
      const specialties = specialtiesInput
        ? specialtiesInput.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const data: SupplierCreate = {
        name: (formData.get('name') as string).trim(),
        category: selectedCategory,
        document_id: (formData.get('document_id') as string || '').trim() || undefined,
        email: (formData.get('email') as string || '').trim() || undefined,
        phone: (formData.get('phone') as string || '').trim() || undefined,
        address: (formData.get('address') as string || '').trim() || undefined,
        specialties,
        notes: (formData.get('notes') as string || '').trim() || undefined,
      }

      await createSupplier.mutateAsync(data)
      router.push('/suppliers')
    } catch (err: unknown) {
      console.error('Create supplier error:', err)
      showError(err, 'Error Creating Supplier')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Add New Supplier</CardTitle>
            <CardDescription>Add a vendor, rental house, or service provider</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., ABC Camera Rentals, John Doe Productions"
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
                  placeholder="CPF/CNPJ or EIN"
                />
                <p className="text-xs text-muted-foreground">
                  Tax identification for invoicing
                </p>
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
                    placeholder="contact@supplier.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
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
              disabled={createSupplier.isPending}
            >
              {createSupplier.isPending ? 'Creating...' : 'Create Supplier'}
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
