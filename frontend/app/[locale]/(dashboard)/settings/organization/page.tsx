'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Building2, Wallet, Percent } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale, useTranslations } from 'next-intl'
import { Organization, formatCurrency } from '@/types'
import { useBankAccounts } from '@/lib/api/hooks'

export default function OrganizationSettingsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('settings.organizationPage')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    cnpj_tax_rate: '',
    produtora_tax_rate: '',
    default_bank_account_id: 'none',
  })

  const { data: bankAccounts } = useBankAccounts(organizationId || undefined)

  useEffect(() => {
    if (organizationId) {
      loadOrganization()
    }
  }, [organizationId])

  const loadOrganization = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.get<Organization>('/api/v1/organizations/me')
      setOrganization(data)
      setFormData({
        name: data.name || '',
        tax_id: data.tax_id || '',
        cnpj_tax_rate: data.cnpj_tax_rate != null ? String(data.cnpj_tax_rate) : '0',
        produtora_tax_rate: data.produtora_tax_rate != null ? String(data.produtora_tax_rate) : '0',
        default_bank_account_id: data.default_bank_account_id || 'none',
      })
    } catch (error) {
      console.error('Failed to load organization:', error)
      toast.error(tCommon('feedback.actionError', { message: 'Failed to load organization details' }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!organizationId || !organization) return

    try {
      setIsSaving(true)
      await apiClient.put(`/api/v1/organizations/${organization.id}`, {
        name: formData.name,
        tax_id: formData.tax_id || null,
        cnpj_tax_rate: formData.cnpj_tax_rate ? parseFloat(formData.cnpj_tax_rate) : 0,
        produtora_tax_rate: formData.produtora_tax_rate ? parseFloat(formData.produtora_tax_rate) : 0,
        default_bank_account_id: formData.default_bank_account_id === 'none' ? null : formData.default_bank_account_id,
      })
      toast.success(tCommon('feedback.actionSuccess'))
      await loadOrganization()
    } catch (error) {
      console.error('Failed to update organization:', error)
      toast.error(tCommon('feedback.actionError', { message: 'Failed to update organization' }))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span>Settings / Organization</span>
        </div>
        <div className="mt-3">
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/15 rounded-lg">
              <Building2 className="h-5 w-5 text-info" />
            </div>
            <div>
              <CardTitle>{t('card.title')}</CardTitle>
              <CardDescription>{t('card.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="organization_id">{t('fields.organizationId')}</Label>
              <Input
                id="organization_id"
                value={organization?.id || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t('fields.organizationIdHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('fields.organizationNameRequired')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('fields.organizationNamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_id">{t('fields.taxId')}</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder={t('fields.taxIdPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('fields.taxIdHelp')}
              </p>
            </div>

            {/* Default Tax Rates */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('fields.defaultTaxRates')}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cnpj_tax_rate">{t('fields.cnpjTaxRate')}</Label>
                  <div className="relative">
                    <Input
                      id="cnpj_tax_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.cnpj_tax_rate}
                      onChange={(e) => setFormData({ ...formData, cnpj_tax_rate: e.target.value })}
                      placeholder="0.00"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('fields.cnpjTaxRateHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="produtora_tax_rate">{t('fields.produtoraTaxRate')}</Label>
                  <div className="relative">
                    <Input
                      id="produtora_tax_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.produtora_tax_rate}
                      onChange={(e) => setFormData({ ...formData, produtora_tax_rate: e.target.value })}
                      placeholder="0.00"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('fields.produtoraTaxRateHelp')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_bank_account">{t('fields.principalBankAccount')}</Label>
              <Select
                value={formData.default_bank_account_id}
                onValueChange={(value) => setFormData({ ...formData, default_bank_account_id: value })}
              >
                <SelectTrigger id="default_bank_account">
                  <SelectValue placeholder={t('fields.selectBankAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('fields.noDefaultAccount')}</SelectItem>
                  {bankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span>{account.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({formatCurrency(account.balance_cents, account.currency)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('fields.principalBankAccountHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('fields.created')}</Label>
              <p className="text-sm text-muted-foreground">
                {organization?.created_at
                  ? new Date(organization.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                  : t('fields.createdUnknown')}
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? tSettings('saving') : tSettings('saveChanges')}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/settings">{tSettings('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
