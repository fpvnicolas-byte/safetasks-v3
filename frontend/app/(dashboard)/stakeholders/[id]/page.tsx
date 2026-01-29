'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStakeholder, useUpdateStakeholder } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks'
import { useSupplier, useSupplierStatement } from '@/lib/api/hooks/useSuppliers'
import { useAuth } from '@/contexts/AuthContext'
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
import { StakeholderUpdate } from '@/types'

export default function EditStakeholderPage() {
  const params = useParams()
  const router = useRouter()
  const stakeholderId = params.id as string

  const { organizationId } = useAuth()
  const { data: stakeholder, isLoading } = useStakeholder(stakeholderId)
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const updateStakeholder = useUpdateStakeholder()

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
      })
    }
  }, [stakeholder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.role) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await updateStakeholder.mutateAsync({
        stakeholderId,
        data: formData,
      })
      toast.success('Stakeholder updated successfully')
      router.push('/stakeholders')
    } catch (error) {
      toast.error('Failed to update stakeholder')
      console.error('Update error:', error)
    }
  }

  if (isLoading || isLoadingProjects) {
    return <div className="p-8">Loading...</div>
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
          <h1 className="text-3xl font-bold tracking-tight">Edit Stakeholder</h1>
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
                Project <span className="text-red-500">*</span>
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
                Name <span className="text-red-500">*</span>
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
                Role <span className="text-red-500">*</span>
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
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
    </div>
  )
}
