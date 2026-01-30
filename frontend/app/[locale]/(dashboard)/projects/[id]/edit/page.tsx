'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProject, useUpdateProject, useClients } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProjectFormData, ProjectStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { dollarsToCents, centsToDollars } from '@/lib/utils/money'
import { FormSkeleton } from '@/components/LoadingSkeletons'

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const { organizationId } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: project, isLoading } = useProject(projectId)
  const { data: clients, isLoading: isLoadingClients } = useClients(organizationId || '')
  const updateProject = useUpdateProject(projectId, organizationId || '')

  if (isLoading || isLoadingClients) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Project</CardTitle>
            <CardDescription>Update project details</CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!project) {
    return <div className="p-8 text-destructive">Project not found</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const budgetDollars = parseFloat(formData.get('budget') as string) || 0

      const data: Partial<ProjectFormData> = {
        client_id: formData.get('client_id') as string,
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: formData.get('status') as ProjectStatus,
        start_date: (formData.get('start_date') as string || '').trim() || undefined,
        end_date: (formData.get('end_date') as string || '').trim() || undefined,
        budget_total_cents: dollarsToCents(budgetDollars),
      }

      await updateProject.mutateAsync(data)
      router.push(`/projects/${projectId}`)
    } catch (err: any) {
      console.error('Update project error:', err)
      showError(err, 'Error Updating Project')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Project</CardTitle>
            <CardDescription>Update project details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="client_id">Client *</Label>
              <Select name="client_id" defaultValue={project.client_id} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                name="title"
                defaultValue={project.title}
                placeholder="My Feature Film"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Project description..."
                rows={3}
                defaultValue={project.description || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select name="status" defaultValue={project.status} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pre-production">Pre-Production</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="post-production">Post-Production</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={project.start_date || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  defaultValue={project.end_date || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Total Budget ($)</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                step="0.01"
                min="0"
                defaultValue={centsToDollars(project.budget_total_cents)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Enter budget in dollars (stored as cents internally)
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateProject.isPending}>
              {updateProject.isPending ? 'Saving...' : 'Save Changes'}
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
