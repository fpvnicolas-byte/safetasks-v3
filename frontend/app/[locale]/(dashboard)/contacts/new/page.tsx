'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateSupplier } from '@/lib/api/hooks'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { SupplierCreate, SupplierCategory } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { useTranslations } from 'next-intl'

export default function NewContactPage() {
  const router = useRouter()
  const t = useTranslations('contacts')
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory>('freelancer')

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
      router.push('/contacts')
    } catch (err: unknown) {
      showError(err, t('form.createError'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('form.createTitle')}</CardTitle>
            <CardDescription>{t('form.createDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.basicInfo')}</h3>
              <div className="space-y-2">
                <Label htmlFor="name">{t('form.name')} *</Label>
                <Input id="name" name="name" placeholder={t('form.namePlaceholder')} required />
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
                <Input id="document_id" name="document_id" placeholder={t('form.documentIdPlaceholder')} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.contactInfo')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('form.email')}</Label>
                  <Input id="email" name="email" type="email" placeholder={t('form.emailPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('form.phone')}</Label>
                  <Input id="phone" name="phone" type="tel" placeholder={t('form.phonePlaceholder')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t('form.address')}</Label>
                <Textarea id="address" name="address" placeholder={t('form.addressPlaceholder')} rows={2} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('form.additionalDetails')}</h3>
              <div className="space-y-2">
                <Label htmlFor="specialties">{t('form.specialties')}</Label>
                <Input id="specialties" name="specialties" placeholder={t('form.specialtiesPlaceholder')} />
                <p className="text-xs text-muted-foreground">{t('form.specialtiesHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <Textarea id="notes" name="notes" placeholder={t('form.notesPlaceholder')} rows={3} />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={createSupplier.isPending}>
              {createSupplier.isPending ? t('form.creating') : t('form.create')}
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
