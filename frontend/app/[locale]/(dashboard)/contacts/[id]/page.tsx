'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useContact } from '@/lib/api/hooks/useContacts'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { useTranslations } from 'next-intl'
import { useDeleteSupplier } from '@/lib/api/hooks'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { getSupplierCategoryDisplayName } from '@/types'
import { ContactInfoTab } from '@/components/contacts/ContactInfoTab'
import { ContactProjectsTab } from '@/components/contacts/ContactProjectsTab'
import { ContactFinancialsTab } from '@/components/contacts/ContactFinancialsTab'
import { ContactAccessTab } from '@/components/contacts/ContactAccessTab'

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const contactId = params.id as string
  const t = useTranslations('contacts')

  const { data: contact, isLoading, error } = useContact(contactId)
  const deleteSupplier = useDeleteSupplier()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (error || !contact) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('notFound')}</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    try {
      await deleteSupplier.mutateAsync(contactId)
      router.push('/contacts')
    } catch (err) {
      console.error('Failed to delete contact:', err)
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleteSupplier.isPending}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: contact.name })}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{contact.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {getSupplierCategoryDisplayName(contact.category)}
              </Badge>
              <Badge variant={contact.is_active ? 'default' : 'outline'}>
                {contact.is_active ? t('card.active') : t('card.inactive')}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <LocaleLink href={`/contacts/${contactId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('card.edit')}
            </LocaleLink>
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('card.delete')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="projects">{t('tabs.projects')}</TabsTrigger>
          <TabsTrigger value="financials">{t('tabs.financials')}</TabsTrigger>
          <TabsTrigger value="access">{t('tabs.access')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ContactInfoTab contact={contact} />
        </TabsContent>
        <TabsContent value="projects">
          <ContactProjectsTab contact={contact} />
        </TabsContent>
        <TabsContent value="financials">
          <ContactFinancialsTab contact={contact} organizationId={organizationId || ''} />
        </TabsContent>
        <TabsContent value="access">
          <ContactAccessTab contact={contact} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
