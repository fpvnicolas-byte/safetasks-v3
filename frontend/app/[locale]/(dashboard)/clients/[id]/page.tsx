'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useClient, useDeleteClient } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Trash2, Mail, Phone, FileText, Calendar, Building } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useState } from 'react'

export default function ClientViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const t = useTranslations('clients')
  const { data: client, isLoading, error } = useClient(resolvedParams.id)
  const deleteClient = useDeleteClient()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = async () => {
    if (!client) return

    try {
      await deleteClient.mutateAsync(client.id)
      router.push('/clients')
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete client: ${error.message}`)
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loading...</h1>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clients
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Client not found or failed to load.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleteClient.isPending}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: client.name })}
      />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{client.name}</h1>
          <div className="mt-2">
            {client.is_active ? (
              <Badge variant="success">
                Active
              </Badge>
            ) : (
              <Badge variant="outline">
                Inactive
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Client
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={deleteClient.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Client Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Client contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email ? (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${client.email}`}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    {client.email}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground italic">Not provided</p>
                </div>
              </div>
            )}

            {client.phone ? (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    {client.phone}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground italic">Not provided</p>
                </div>
              </div>
            )}

            {client.document ? (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Document (CPF/CNPJ/Tax ID)</p>
                  <p className="text-sm text-muted-foreground">{client.document}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Document</p>
                  <p className="text-sm text-muted-foreground italic">Not provided</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Client record details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Client ID</p>
                <p className="text-sm text-muted-foreground font-mono">{client.id}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(client.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(client.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Related Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Related Projects</CardTitle>
          <CardDescription>Projects associated with this client</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Project listing will be available once the client-project relationship is queried.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href={`/projects?client=${client.id}`}>
              View Projects
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
