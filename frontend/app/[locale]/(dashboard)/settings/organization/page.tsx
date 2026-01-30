'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale, useTranslations } from 'next-intl'

interface Organization {
  id: string
  name: string
  tax_id: string | null
  created_at: string
}

export default function OrganizationSettingsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('settings.organizationPage')
  const tCommon = useTranslations('common.feedback')
  const tSettings = useTranslations('settings')
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
  })

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
      })
    } catch (error) {
      console.error('Failed to load organization:', error)
      toast.error(tCommon('actionError', { message: 'Failed to load organization details' }))
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
      })
      toast.success(tCommon('actionSuccess'))
      await loadOrganization()
    } catch (error) {
      console.error('Failed to update organization:', error)
      toast.error(tCommon('actionError', { message: 'Failed to update organization' }))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
