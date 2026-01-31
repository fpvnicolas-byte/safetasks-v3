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
import { useTranslations } from 'next-intl'

export default function NewTaxTablePage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const createTaxTable = useCreateTaxTable()
  const t = useTranslations('financials.pages.taxTablesNew')
  const tCommon = useTranslations('common')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const ratePercentage = parseFloat(formData.get('rate_percentage') as string)

    // Validation
    if (ratePercentage < 0 || ratePercentage > 100) {
      setError(t('errors.rateRange'))
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
      setError(error.message || t('errors.createFailed'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('form.title')}</CardTitle>
            <CardDescription>
              {t('form.description')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t('fields.name.label')}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t('fields.name.placeholder')}
                required
              />
              <p className="text-sm text-muted-foreground">
                {t('fields.name.help')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type">{t('fields.type.label')}</Label>
              <Select name="tax_type" required>
                <SelectTrigger>
                  <SelectValue placeholder={t('fields.type.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iss">{t('taxTypes.iss')}</SelectItem>
                  <SelectItem value="irrf">{t('taxTypes.irrf')}</SelectItem>
                  <SelectItem value="pis">{t('taxTypes.pis')}</SelectItem>
                  <SelectItem value="cofins">{t('taxTypes.cofins')}</SelectItem>
                  <SelectItem value="csll">{t('taxTypes.csll')}</SelectItem>
                  <SelectItem value="inss">{t('taxTypes.inss')}</SelectItem>
                  <SelectItem value="rental_tax">{t('taxTypes.rental_tax')}</SelectItem>
                  <SelectItem value="other">{t('taxTypes.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_percentage">{t('fields.rate.label')}</Label>
              <Input
                id="rate_percentage"
                name="rate_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder={t('fields.rate.placeholder')}
                required
              />
              <p className="text-sm text-muted-foreground">
                {t('fields.rate.help')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('fields.description.label')}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t('fields.description.placeholder')}
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
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={createTaxTable.isPending}>
              {createTaxTable.isPending ? t('actions.creating') : t('actions.create')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
