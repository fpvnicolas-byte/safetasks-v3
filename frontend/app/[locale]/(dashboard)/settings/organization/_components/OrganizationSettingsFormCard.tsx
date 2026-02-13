'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Wallet, Percent } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Organization, BankAccount, formatCurrency } from '@/types'

interface OrganizationFormData {
  name: string
  tax_id: string
  cnpj_tax_rate: string
  produtora_tax_rate: string
  default_bank_account_id: string
}

interface OrganizationSettingsFormCardProps {
  organization: Organization | null
  formData: OrganizationFormData
  bankAccounts: BankAccount[] | undefined
  isSaving: boolean
  locale: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof OrganizationFormData, value: string) => void
}

export function OrganizationSettingsFormCard({
  organization,
  formData,
  bankAccounts,
  isSaving,
  locale,
  onSubmit,
  onFieldChange,
}: OrganizationSettingsFormCardProps) {
  const t = useTranslations('settings.organizationPage')
  const tSettings = useTranslations('settings')

  return (
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
        <form onSubmit={onSubmit} className="space-y-6">
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
              onChange={(e) => onFieldChange('name', e.target.value)}
              placeholder={t('fields.organizationNamePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_id">{t('fields.taxId')}</Label>
            <Input
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => onFieldChange('tax_id', e.target.value)}
              placeholder={t('fields.taxIdPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('fields.taxIdHelp')}
            </p>
          </div>

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
                    onChange={(e) => onFieldChange('cnpj_tax_rate', e.target.value)}
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
                    onChange={(e) => onFieldChange('produtora_tax_rate', e.target.value)}
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
              onValueChange={(value) => onFieldChange('default_bank_account_id', value)}
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
  )
}
