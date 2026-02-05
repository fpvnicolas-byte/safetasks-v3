'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateStakeholder } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks'
import { useSuppliers } from '@/lib/api/hooks/useSuppliers'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorDialog } from '@/components/ui/error-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { StakeholderCreate, RateType } from '@/types'
import { useTranslations, useLocale } from 'next-intl'

export default function NewStakeholderPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: suppliers, isLoading: isLoadingSuppliers } = useSuppliers(organizationId || undefined)
  const createStakeholder = useCreateStakeholder()
  const { errorDialog, showError, closeError } = useErrorDialog()

  const [enablePayments, setEnablePayments] = useState(false)

  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('project_id') || ''

  const [formData, setFormData] = useState<StakeholderCreate>({
    project_id: initialProjectId,
    name: '',
    role: '',
    email: '',
    phone: '',
    notes: '',
    supplier_id: undefined,
    rate_type: undefined,
    rate_value_cents: undefined,
    estimated_units: undefined,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.project_id || !formData.name || !formData.role) {
      toast.error(tFeedback('enterText')) // Generic "please enter text" or "fill required" - using enterText as proxy or add new key
      return
    }

    try {
      // Clean up the data before sending - convert empty strings to undefined
      const cleanedData: StakeholderCreate = {
        project_id: formData.project_id,
        name: formData.name.trim(),
        role: formData.role.trim(),
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        supplier_id: formData.supplier_id || undefined,
        rate_type: formData.rate_type || undefined,
        rate_value_cents: formData.rate_value_cents || undefined,
        estimated_units: formData.estimated_units || undefined,
      }

      console.log('Creating stakeholder with cleaned data:', cleanedData)
      await createStakeholder.mutateAsync(cleanedData)
      toast.success(tFeedback('actionSuccess'))
      router.push(`/${locale}/stakeholders`)
    } catch (error: unknown) {
      // Improved error logging - show full error details
      const errorObj = error as Record<string, unknown>
      console.error('Create error:', JSON.stringify(errorObj, null, 2))
      console.error('Error message:', errorObj?.message)
      console.error('Error details:', errorObj?.details)
      console.error('Raw error:', error)
      showError(error, tFeedback('actionError', { message: 'Error Creating Stakeholder' }))
    }
  }

  if (isLoadingProjects || isLoadingSuppliers) {
    return <div className="p-8">{tCommon('loading')}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stakeholders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">New Stakeholder</h1>
          <p className="text-muted-foreground">Add a new team member to your project</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Stakeholder Information</CardTitle>
          <CardDescription>Enter the details for the new stakeholder</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="project_id">
                Project <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {tCommon('name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Director, Producer, DP, etc."
                required
              />
            </div>

            {/* Payment Tracking Section */}
            <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable_payments"
                  checked={enablePayments}
                  onCheckedChange={(checked) => {
                    setEnablePayments(!!checked)
                    if (!checked) {
                      setFormData({ ...formData, supplier_id: undefined })
                    }
                  }}
                />
                <Label htmlFor="enable_payments" className="cursor-pointer font-medium">
                  Enable payment tracking for this stakeholder
                </Label>
              </div>

              {enablePayments && (
                <div className="space-y-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_id">Link to Supplier (Optional)</Label>
                    <Select
                      value={formData.supplier_id || '__auto_create__'}
                      onValueChange={(value) => {
                        if (value === '__auto_create__') {
                          setFormData({ ...formData, supplier_id: undefined })
                        } else {
                          // Auto-fill data from selected supplier
                          const selectedSupplier = suppliers?.find(s => s.id === value)
                          setFormData({
                            ...formData,
                            supplier_id: value,
                            // Auto-fill fields if they exist on the supplier
                            name: selectedSupplier?.name || formData.name,
                            email: selectedSupplier?.email || formData.email,
                            phone: selectedSupplier?.phone || formData.phone,
                          })
                        }
                      }}
                    >
                      <SelectTrigger id="supplier_id">
                        <SelectValue placeholder="Select existing supplier or leave blank to auto-create" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto_create__">Auto-create new supplier</SelectItem>
                        {suppliers?.filter(s => s.category === 'freelancer').map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {formData.supplier_id
                        ? "Will link to existing supplier for payment tracking"
                        : "A new supplier will be created automatically with this stakeholder's information"}
                    </p>
                  </div>

                  {/* Rate Configuration */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <h4 className="font-medium text-sm">Rate Configuration</h4>

                    <div className="space-y-2">
                      <Label htmlFor="rate_type">Rate Type</Label>
                      <Select
                        value={formData.rate_type || '__none__'}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          rate_type: value === '__none__' ? undefined : value as RateType,
                          // Reset estimated_units when changing type
                          estimated_units: undefined
                        })}
                      >
                        <SelectTrigger id="rate_type">
                          <SelectValue placeholder="Select rate type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No rate configured</SelectItem>
                          <SelectItem value="daily">Daily Rate (R$/day)</SelectItem>
                          <SelectItem value="hourly">Hourly Rate (R$/hour)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount (total)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.rate_type && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="rate_value">
                            {formData.rate_type === 'daily' ? 'Rate per Day (R$)' :
                              formData.rate_type === 'hourly' ? 'Rate per Hour (R$)' :
                                'Fixed Amount (R$)'}
                          </Label>
                          <Input
                            id="rate_value"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.rate_value_cents ? (formData.rate_value_cents / 100).toFixed(2) : ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              rate_value_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined
                            })}
                            placeholder="500.00"
                          />
                        </div>

                        {formData.rate_type === 'hourly' && (
                          <div className="space-y-2">
                            <Label htmlFor="estimated_hours">Estimated Hours</Label>
                            <Input
                              id="estimated_hours"
                              type="number"
                              min="0"
                              value={formData.estimated_units || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                estimated_units: e.target.value ? parseInt(e.target.value) : undefined
                              })}
                              placeholder="40"
                            />
                          </div>
                        )}

                        {formData.rate_type === 'daily' && (
                          <div className="space-y-2">
                            <Label htmlFor="estimated_days">Estimated Days (optional)</Label>
                            <Input
                              id="estimated_days"
                              type="number"
                              min="0"
                              value={formData.estimated_units || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                estimated_units: e.target.value ? parseInt(e.target.value) : undefined
                              })}
                              placeholder="Leave empty to use shooting days count"
                            />
                            <p className="text-sm text-muted-foreground">
                              If empty, system will use the project&apos;s shooting days count
                            </p>
                          </div>
                        )}

                        {/* Show calculated amount preview */}
                        {formData.rate_value_cents && (
                          <div className="rounded-md bg-primary/10 p-3">
                            <p className="text-sm font-medium">
                              {formData.rate_type === 'fixed' ? (
                                <>Total: R$ {(formData.rate_value_cents / 100).toFixed(2)}</>
                              ) : formData.rate_type === 'daily' && formData.estimated_units ? (
                                <>Estimated Total: R$ {((formData.rate_value_cents * formData.estimated_units) / 100).toFixed(2)} ({formData.estimated_units} days x R$ {(formData.rate_value_cents / 100).toFixed(2)})</>
                              ) : formData.rate_type === 'hourly' && formData.estimated_units ? (
                                <>Estimated Total: R$ {((formData.rate_value_cents * formData.estimated_units) / 100).toFixed(2)} ({formData.estimated_units} hours x R$ {(formData.rate_value_cents / 100).toFixed(2)})</>
                              ) : formData.rate_type === 'daily' ? (
                                <>Rate: R$ {(formData.rate_value_cents / 100).toFixed(2)}/day (total will be calculated from shooting days)</>
                              ) : (
                                <>Rate: R$ {(formData.rate_value_cents / 100).toFixed(2)}/hour (enter hours to see total)</>
                              )}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{tCommon('email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{tCommon('phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{tCommon('notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about this stakeholder..."
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={createStakeholder.isPending}>
                {createStakeholder.isPending ? tCommon('saving') : tCommon('create')}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/stakeholders">{tCommon('cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
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
