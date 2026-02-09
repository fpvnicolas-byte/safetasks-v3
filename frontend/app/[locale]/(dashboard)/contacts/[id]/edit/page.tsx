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
import { useTranslations } from 'next-intl'

export default function EditContactPage() {
  const router = useRouter()
  const params = useParams()
  const { organizationId } = useAuth()
  const contactId = params.id as string
  const t = useTranslations('contacts')

  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory>('freelancer')
  const [isActive, setIsActive] = useState(true)

  const { data: supplier, isLoading } = useSupplier(contactId, organizationId || undefined)
  const updateSupplier = useUpdateSupplier()

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
            <CardTitle>{t('form.editTitle')}</CardTitle>
          </CardHeader>
          <CardContent><div>{t('loading')}</div></CardContent>
        </Card>
      </div>
    )
  }

  if (!supplier) {
    return <div className="p-8 text-destructive">{t('notFound')}</div>
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

      await updateSupplier.mutateAsync({ supplierId: contactId, data })
      router.push(`/contacts/${contactId}`)
    } catch (err: any) {
      showError(err, t('form.editError'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('form.editTitle')}</CardTitle>
            <CardDescription>{t('form.editDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">{t('form.activeStatus')}</Label>
                <div className="text-sm text-muted-foreground">{t('form.activeStatusHint')}</div>
              </div>
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.basicInfo')}</h3>
              <div className="space-y-2">
                <Label htmlFor="name">{t('form.name')} *</Label>
                <Input id="name" name="name" defaultValue={supplier.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">{t('form.category')} *</Label>
                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as SupplierCategory)} required>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freelancer">{t('filters.freelancer')}</SelectItem>
                    <SelectItem value="rental_house">{t('filters.rentalHouse')}</SelectItem>
                    <SelectItem value="catering">{t('filters.catering')}</SelectItem>
                    <SelectItem value="transport">{t('filters.transport')}</SelectItem>
                    <SelectItem value="post_production">{t('filters.postProduction')}</SelectItem>
                    <SelectItem value="other">{t('filters.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_id">{t('form.documentId')}</Label>
                <Input id="document_id" name="document_id" defaultValue={supplier.document_id || ''} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.contactInfo')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('form.email')}</Label>
                  <Input id="email" name="email" type="email" defaultValue={supplier.email || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('form.phone')}</Label>
                  <Input id="phone" name="phone" type="tel" defaultValue={supplier.phone || ''} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t('form.address')}</Label>
                <Textarea id="address" name="address" defaultValue={supplier.address || ''} rows={2} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.additionalDetails')}</h3>
              <div className="space-y-2">
                <Label htmlFor="specialties">{t('form.specialties')}</Label>
                <Input id="specialties" name="specialties" defaultValue={supplier.specialties?.join(', ') || ''} />
                <p className="text-xs text-muted-foreground">{t('form.specialtiesHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <Textarea id="notes" name="notes" defaultValue={supplier.notes || ''} rows={3} />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={updateSupplier.isPending}>
              {updateSupplier.isPending ? t('form.saving') : t('form.save')}
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
