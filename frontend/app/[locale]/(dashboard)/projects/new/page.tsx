'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LocaleLink } from '@/components/LocaleLink'
import { useCreateProject, useClients, useServices } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProjectCreate, ProjectStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { dollarsToCents } from '@/types'
import { useTranslations } from 'next-intl'

export default function NewProjectPage() {
  const t = useTranslations('projects')
  const router = useRouter()
  const { organizationId, isLoading: isLoadingOrg } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [status, setStatus] = useState<ProjectStatus>('pre-production')

  const { data: clients, isLoading: clientsLoading } = useClients(organizationId || undefined)
  const { data: services, isLoading: servicesLoading } = useServices(organizationId || undefined)
  const createProject = useCreateProject(organizationId ?? undefined)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedClientId) {
      showError({ message: t('form.pleaseSelectClient') }, t('form.validationError'))
      return
    }

    if (!organizationId) {
      showError({ message: t('errors.noOrganization') }, t('form.validationError'))
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
      const budgetDollars = parseFloat(formData.get('budget_total') as string || '0')

      const data: ProjectCreate = {
        client_id: selectedClientId,
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: status,
        start_date: (formData.get('start_date') as string) || undefined,
        end_date: (formData.get('end_date') as string) || undefined,
        budget_total_cents: budgetDollars ? dollarsToCents(budgetDollars) : undefined,
        service_ids: selectedServices.length > 0 ? selectedServices : undefined,
      }

      await createProject.mutateAsync(data)
      router.push('/projects')
    } catch (err: any) {
      console.error('Create project error:', err)
      showError(err, t('form.errorCreating'))
    }
  }

  if (isLoadingOrg) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-sm text-muted-foreground">
        Loading organization...
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-sm text-destructive">
        {t('errors.noOrganization')}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('form.newTitle')}</CardTitle>
            <CardDescription>{t('form.newProjectSubtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client">{t('form.clientRequired')}</Label>
              {clientsLoading ? (
                <div className="text-sm text-muted-foreground">{t('form.loadingClients')}</div>
              ) : clients && clients.length > 0 ? (
                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectAClient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('form.noClientsFound')}</p>
                  <Button asChild size="sm" variant="outline">
                    <LocaleLink href="/clients/new">{t('form.createClient')}</LocaleLink>
                  </Button>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('form.titleRequired')}</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder={t('form.titlePlaceholder')}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">{t('form.statusLabel')}</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('form.statusDraft')}</SelectItem>
                      <SelectItem value="pre-production">{t('form.statusPreProduction')}</SelectItem>
                      <SelectItem value="production">{t('form.statusProduction')}</SelectItem>
                      <SelectItem value="post-production">{t('form.statusPostProduction')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget_total">{t('form.budgetLabel')}</Label>
                  <Input
                    id="budget_total"
                    name="budget_total"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('form.budgetPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">{t('form.startDateLabel')}</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">{t('form.endDateLabel')}</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('form.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('form.descriptionPlaceholderNew')}
                  rows={3}
                />
              </div>

              {/* Services */}
              <div className="space-y-2">
                <Label>{t('form.servicesLabel')}</Label>
                <Card className="p-4">
                  {servicesLoading ? (
                    <div className="text-sm text-muted-foreground p-2">{t('form.loadingServices')}</div>
                  ) : services && services.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services.map((service) => (
                        <div key={service.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={`service-${service.id}`}
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedServices([...selectedServices, service.id])
                              } else {
                                setSelectedServices(selectedServices.filter(id => id !== service.id))
                              }
                            }}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <Label
                              htmlFor={`service-${service.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {service.name}
                            </Label>
                            {service.description && (
                              <p className="text-xs text-muted-foreground">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 text-center">
                      <p>{t('form.noServicesDefined')}</p>
                      <Button variant="link" asChild className="px-0 h-auto">
                        <LocaleLink href="/settings/services">{t('form.manageServices')}</LocaleLink>
                      </Button>
                    </div>
                  )}
                </Card>
              </div>

            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {t('form.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || !selectedClientId}
            >
              {createProject.isPending ? t('form.creating') : t('form.create')}
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
