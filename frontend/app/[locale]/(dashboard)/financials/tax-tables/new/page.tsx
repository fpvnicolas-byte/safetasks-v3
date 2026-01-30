'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateTaxTable } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { TaxTableCreate, TaxType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function NewTaxTablePage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const createTaxTable = useCreateTaxTable()

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
      const data: TaxTableCreate = {
        name: formData.get('name') as string,
        tax_type: formData.get('tax_type') as TaxType,
        rate_percentage: ratePercentage,
        description: (formData.get('description') as string) || undefined,
      }

      await createTaxTable.mutateAsync(data)
      router.push('/financials/tax-tables')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || 'Failed to create tax table')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Tax Table</h1>
        <p className="text-muted-foreground">
          Configure a new tax rate for Brazilian tax compliance
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Tax Table Details</CardTitle>
            <CardDescription>
              Enter the tax information and applicable rate
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
                placeholder="e.g., ISS 5% - São Paulo"
                required
              />
              <p className="text-sm text-muted-foreground">
                A descriptive name for this tax table
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type">Tax Type *</Label>
              <Select name="tax_type" required>
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
                placeholder="e.g., 5.00"
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter the tax rate as a percentage (0-100)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Additional notes about this tax..."
                rows={3}
              />
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
            <Button type="submit" disabled={createTaxTable.isPending}>
              {createTaxTable.isPending ? 'Creating...' : 'Create Tax Table'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
