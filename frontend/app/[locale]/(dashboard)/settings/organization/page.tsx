'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale, useTranslations } from 'next-intl'
import { Organization } from '@/types'
import { useBankAccounts } from '@/lib/api/hooks'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const OrganizationSettingsFormCard = dynamic(
  () => import('./_components/OrganizationSettingsFormCard').then((mod) => mod.OrganizationSettingsFormCard),
  {
    ssr: false,
    loading: () => (
      <Card className="max-w-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ),
  }
)

interface OrganizationFormData {
  name: string
  tax_id: string
  cnpj_tax_rate: string
  produtora_tax_rate: string
  default_bank_account_id: string
}

export default function OrganizationSettingsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('settings.organizationPage')
  const tCommon = useTranslations('common')

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    tax_id: '',
    cnpj_tax_rate: '',
    produtora_tax_rate: '',
    default_bank_account_id: 'none',
  })

  const { data: bankAccounts } = useBankAccounts(organizationId || undefined)

  const loadOrganization = useCallback(async () => {
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
  }, [tCommon])

  useEffect(() => {
    if (organizationId) {
      void loadOrganization()
    }
  }, [organizationId, loadOrganization])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleFieldChange = (field: keyof OrganizationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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

      <OrganizationSettingsFormCard
        organization={organization}
        formData={formData}
        bankAccounts={bankAccounts}
        isSaving={isSaving}
        locale={locale}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
      />
    </div>
  )
}
