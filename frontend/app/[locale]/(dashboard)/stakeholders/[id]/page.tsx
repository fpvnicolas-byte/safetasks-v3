'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useStakeholder, useUpdateStakeholder } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks'
import { useSupplier, useSupplierStatement } from '@/lib/api/hooks/useSuppliers'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { StakeholderUpdate, RateType } from '@/types'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'

export default function EditStakeholderPage() {
  const params = useParams()
  const router = useRouter()
  const stakeholderId = params.id as string
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')

  const { organizationId } = useAuth()
  const { data: stakeholder, isLoading } = useStakeholder(stakeholderId)
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const updateStakeholder = useUpdateStakeholder()
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Fetch supplier and payment data if linked
  const { data: supplier } = useSupplier(
    stakeholder?.supplier_id || '',
    organizationId || ''
  )
  const { data: statement } = useSupplierStatement(
    stakeholder?.supplier_id || '',
    organizationId || '',
    undefined, // date_from
    undefined, // date_to
    !!stakeholder?.supplier_id // showStatement - enables query when supplier_id exists
  )

  const [formData, setFormData] = useState<StakeholderUpdate>({
    project_id: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    notes: '',
    is_active: true,
    rate_type: undefined,
    rate_value_cents: undefined,
    estimated_units: undefined,
  })

  useEffect(() => {
    if (stakeholder) {
      setFormData({
        project_id: stakeholder.project_id,
        name: stakeholder.name,
        role: stakeholder.role,
        email: stakeholder.email || '',
        phone: stakeholder.phone || '',
        notes: stakeholder.notes || '',
        is_active: stakeholder.is_active,
        rate_type: stakeholder.rate_type || undefined,
        rate_value_cents: stakeholder.rate_value_cents || undefined,
        estimated_units: stakeholder.estimated_units || undefined,
      })
    }
  }, [stakeholder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.role) {
      toast.error(tFeedback('fillRequired'))
      return
    }

    try {
      await updateStakeholder.mutateAsync({
        stakeholderId,
        data: formData,
      })
      toast.success(tFeedback('actionSuccess'))
      router.push(`/${locale}/stakeholders`)
    } catch (error: unknown) {
      console.error('Update error:', error)
      showError(error, tFeedback('actionError', { message: 'Error Updating Stakeholder' }))
    }
  }

  if (isLoading || isLoadingProjects) {
    return <div className="p-8">{tCommon('loading')}</div>
  }

  if (!stakeholder) {
    return <div className="p-8">Stakeholder not found</div>
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-display">Edit Stakeholder</h1>
            <StakeholderStatusBadge status={stakeholder.status || 'requested'} />
          </div>
          <p className="text-muted-foreground">Update stakeholder information</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Stakeholder Information</CardTitle>
          <CardDescription>Update the details for {stakeholder.name}</CardDescription>
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
                Name <span className="text-destructive">*</span>
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

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about this stakeholder..."
                rows={4}
              />
            </div>

            {/* Rate Configuration Section */}
            <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="font-medium">Rate Configuration</h4>

              <div className="space-y-2">
                <Label htmlFor="rate_type">Rate Type</Label>
                <Select
                  value={formData.rate_type || '__none__'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    rate_type: value === '__none__' ? undefined : value as RateType,
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={updateStakeholder.isPending}>
                {updateStakeholder.isPending ? 'Updating...' : 'Update Stakeholder'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/stakeholders">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Payment Information Card */}
      {stakeholder.supplier_id && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>
              Linked to supplier for payment tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplier && (
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Supplier:</span>
                  <span className="text-sm">{supplier.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Category:</span>
                  <Badge variant="secondary">{supplier.category}</Badge>
                </div>
                {supplier.email && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Email:</span>
                    <span className="text-sm">{supplier.email}</span>
                  </div>
                )}
              </div>
            )}

            {statement && (
              <div className="grid gap-2 border-t pt-4">
                <h4 className="font-semibold">Payment Summary</h4>
                <div className="flex justify-between">
                  <span className="text-sm">Total Transactions:</span>
                  <span className="text-sm font-medium">{statement.total_transactions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Paid:</span>
                  <span className="text-sm font-medium">
                    R$ {(statement.total_amount_cents / 100).toFixed(2)}
                  </span>
                </div>
                {statement.transactions.length > 0 && (
                  <div className="mt-2">
                    <Link href={`/suppliers/${stakeholder.supplier_id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        View Full Payment History
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
