'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { StakeholderCreate } from '@/types'
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

  const [formData, setFormData] = useState<StakeholderCreate>({
    project_id: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    notes: '',
    supplier_id: undefined,
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
      }

      console.log('Creating stakeholder with cleaned data:', cleanedData)
      await createStakeholder.mutateAsync(cleanedData)
      toast.success(tFeedback('actionSuccess'))
      router.push(`/${locale}/stakeholders`)
    } catch (error: any) {
      console.error('Create error:', error)
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
                <div className="space-y-2 pl-6">
                  <Label htmlFor="supplier_id">Link to Supplier (Optional)</Label>
                  <Select
                    value={formData.supplier_id || '__auto_create__'}
                    onValueChange={(value) => setFormData({ ...formData, supplier_id: value === '__auto_create__' ? undefined : value })}
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
