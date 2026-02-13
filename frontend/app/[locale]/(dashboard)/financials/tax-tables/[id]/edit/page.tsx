'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTaxTable, useUpdateTaxTable, useDeleteTaxTable } from '@/lib/api/hooks'
import { TaxTableUpdate, TaxType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function EditTaxTablePage() {
  const router = useRouter()
  const params = useParams()
  const taxTableId = params.id as string
  const locale = useLocale()
  const t = useTranslations('financials.pages.taxTablesEdit')
  const tCommon = useTranslations('common')

  const [error, setError] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { data: taxTable, isLoading } = useTaxTable(taxTableId)
  const updateTaxTable = useUpdateTaxTable()
  const deleteTaxTable = useDeleteTaxTable()

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (!taxTable) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('errors.notFound')}</AlertDescription>
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
      setError(t('errors.rateRange'))
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
      setError(error.message || t('errors.updateFailed'))
    }
  }

  async function handleDelete() {
    if (!taxTable) return

    try {
      await deleteTaxTable.mutateAsync(taxTableId)
      router.push('/financials/tax-tables')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || t('errors.deleteFailed'))
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleteTaxTable.isPending}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirm', { name: taxTable.name })}
      />
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
                defaultValue={taxTable.name}
                placeholder={t('fields.name.placeholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type">{t('fields.type.label')}</Label>
              <Select name="tax_type" defaultValue={taxTable.tax_type} required>
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
                defaultValue={taxTable.rate_percentage}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('fields.description.label')}</Label>
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
              <Label htmlFor="is_active">{t('fields.active.label')}</Label>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t('meta.created', {
                  date: new Date(taxTable.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('meta.updated', {
                  date: new Date(taxTable.updated_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                })}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={deleteTaxTable.isPending}
            >
              {t('actions.delete')}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={updateTaxTable.isPending}>
                {updateTaxTable.isPending ? t('actions.saving') : t('actions.save')}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
