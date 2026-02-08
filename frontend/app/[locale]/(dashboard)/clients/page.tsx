'use client'

import { useState } from 'react'
import { useClients, useDeleteClient } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Users, Mail, Phone, FileText } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function ClientsPage() {
  const { organizationId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const t = useTranslations('clients')

  // Get clients data
  const { data: allClients, isLoading, error } = useClients(organizationId || '')
  const deleteClient = useDeleteClient()

  // Apply search filter
  const filteredClients = allClients?.filter(client => {
    if (!searchQuery) return true

    const searchLower = searchQuery.toLowerCase()
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.document?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchQuery)
    )
  }) || []

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClient = async () => {
    if (!deleteTarget || !organizationId) return

    setIsDeleting(true)
    try {
      await deleteClient.mutateAsync({ clientId: deleteTarget.id, organizationId })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      alert(t('delete.error', { message: error.message }))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-destructive">{t('loadingError')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteClient}
        loading={isDeleting}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: deleteTarget?.name || '' })}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newClient')}
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('search.title')}</CardTitle>
          <CardDescription>
            {t('search.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {allClients && allClients.length > 0 ? t('empty.noResults') : t('empty.noClients')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allClients && allClients.length > 0
                  ? t('empty.tryAdjusting')
                  : t('empty.getStarted')}
              </p>
              {(!allClients || allClients.length === 0) && (
                <Button asChild>
                  <Link href="/clients/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.createFirst')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {client.is_active ? (
                        <Badge variant="success">
                          {t('card.active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t('card.inactive')}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {client.email && (
                    <div className="flex items-center text-muted-foreground">
                      <Mail className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.document && (
                    <div className="flex items-center text-muted-foreground">
                      <FileText className="h-4 w-4 mr-2 shrink-0" />
                      <span>{client.document}</span>
                    </div>
                  )}
                  {!client.email && !client.phone && !client.document && (
                    <p className="text-muted-foreground italic">{t('card.noContactInfo')}</p>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/clients/${client.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      {t('card.view')}
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/clients/${client.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      {t('card.edit')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {allClients && allClients.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {allClients.length !== 1
                  ? t('summary.showing_other', { filtered: filteredClients.length, total: allClients.length })
                  : t('summary.showing', { filtered: filteredClients.length, total: allClients.length })
                }
              </span>
              <span>
                {t('summary.activeInactive', {
                  active: allClients.filter(c => c.is_active).length,
                  inactive: allClients.filter(c => !c.is_active).length
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
