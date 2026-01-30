'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTaxTable, useUpdateTaxTable, useDeleteTaxTable } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { TaxTableUpdate, TaxType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { useLocale } from 'next-intl'

export default function EditTaxTablePage() {
  const router = useRouter()
  const params = useParams()
  const taxTableId = params.id as string
  const locale = useLocale()

  const { organizationId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { data: taxTable, isLoading } = useTaxTable(taxTableId)
  const updateTaxTable = useUpdateTaxTable()
  const deleteTaxTable = useDeleteTaxTable()

  if (isLoading) {
    return <div>Loading tax table...</div>
  }

  if (!taxTable) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Tax table not found</AlertDescription>
      </Alert>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const ratePercentage = parseFloat(formData.get('rate_percentage') as string)

    // Validation
    if (ratePercentage < 0 || ratePercentage > 100) {
      setError('Rate percentage must be between 0 and 100')
      return
    }

    try {
      const data: TaxTableUpdate = {
        name: formData.get('name') as string,
        tax_type: formData.get('tax_type') as TaxType,
        rate_percentage: ratePercentage,
        description: (formData.get('description') as string) || undefined,
        is_active: formData.get('is_active') === 'true',
      }

      await updateTaxTable.mutateAsync({ taxTableId, data })
      router.push('/financials/tax-tables')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to update tax table')
    }
  }

  async function handleDelete() {
    if (!taxTable) return

    if (!confirm(`Are you sure you want to delete tax table "${taxTable.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteTaxTable.mutateAsync(taxTableId)
      router.push('/financials/tax-tables')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to delete tax table')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Tax Table</h1>
        <p className="text-muted-foreground">
          Update tax table configuration
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Tax Table Details</CardTitle>
            <CardDescription>
              Modify the tax information and rate
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={taxTable.name}
                placeholder="e.g., ISS 5% - São Paulo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type">Tax Type *</Label>
              <Select name="tax_type" defaultValue={taxTable.tax_type} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iss">ISS (Service Tax)</SelectItem>
                  <SelectItem value="irrf">IRRF (Income Tax Withholding)</SelectItem>
                  <SelectItem value="pis">PIS (Social Contribution)</SelectItem>
                  <SelectItem value="cofins">COFINS (Social Contribution)</SelectItem>
                  <SelectItem value="csll">CSLL (Social Contribution)</SelectItem>
                  <SelectItem value="inss">INSS (Social Security)</SelectItem>
                  <SelectItem value="rental_tax">Rental Tax</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_percentage">Rate Percentage *</Label>
              <Input
                id="rate_percentage"
                name="rate_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={taxTable.rate_percentage}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={taxTable.description || ''}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={taxTable.is_active}
                value="true"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Created: {new Date(taxTable.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(taxTable.updated_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateTaxTable.isPending}>
                {updateTaxTable.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
