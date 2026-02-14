'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useDeleteSupplier } from '@/lib/api/hooks'
import { useContacts } from '@/lib/api/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Users,
  FolderOpen,
  Shield,
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { Contact, SupplierCategory, formatCurrency } from '@/types'
import type { PlatformStatus } from '@/types'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectsListSkeleton } from '@/components/LoadingSkeletons'

const ContactsTeamTab = dynamic(
  () => import('./_components/ContactsTeamTab').then((mod) => mod.ContactsTeamTab),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ),
  }
)

const PLATFORM_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const CATEGORY_TRANSLATION_KEYS: Record<SupplierCategory, string> = {
  rental_house: 'categories.rental_house',
  freelancer: 'categories.freelancer',
  catering: 'categories.catering',
  transport: 'categories.transport',
  post_production: 'categories.post_production',
  other: 'categories.other',
}

export default function ContactsPage() {
  const t = useTranslations('contacts')
  const [activeTab, setActiveTab] = useState<'contacts' | 'team'>('contacts')

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SupplierCategory | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformStatus | 'all'>('all')
  const activeOnly = true

  const { data: contacts, isLoading, error } = useContacts(
    {
      search: searchQuery || undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      platform_status: platformFilter === 'all' ? undefined : platformFilter,
      active_only: activeOnly,
    },
    { enabled: activeTab === 'contacts' }
  )

  const deleteSupplier = useDeleteSupplier()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const getCategoryLabel = (category: SupplierCategory) => t(CATEGORY_TRANSLATION_KEYS[category])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteSupplier.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const errorObj = err as Error
      toast.error(errorObj.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: deleteTarget?.name || '' })}
      />

      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('breadcrumb')}
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <LocaleLink href="/contacts/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('addContact')}
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === 'team' ? 'team' : 'contacts')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">
            <Users className="mr-2 h-4 w-4" />
            {t('tabs.contacts')}
            {contacts && <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="team">
            <Shield className="mr-2 h-4 w-4" />
            {t('tabs.team')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('filters.title')}</CardTitle>
              <CardDescription>{t('filters.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('filters.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.category')}</label>
                  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as SupplierCategory | 'all')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
                      <SelectItem value="rental_house">{t('filters.rentalHouse')}</SelectItem>
                      <SelectItem value="freelancer">{t('filters.freelancer')}</SelectItem>
                      <SelectItem value="catering">{t('filters.catering')}</SelectItem>
                      <SelectItem value="transport">{t('filters.transport')}</SelectItem>
                      <SelectItem value="post_production">{t('filters.postProduction')}</SelectItem>
                      <SelectItem value="other">{t('filters.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.platformStatus')}</label>
                  <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformStatus | 'all')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allAccess')}</SelectItem>
                      <SelectItem value="active">{t('filters.platformActive')}</SelectItem>
                      <SelectItem value="invited">{t('filters.platformInvited')}</SelectItem>
                      <SelectItem value="none">{t('filters.platformNone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.results')}</label>
                  <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">
                      {(contacts?.length ?? 0) === 1
                        ? t('filters.contactCount', { count: 1 })
                        : t('filters.contactCount_other', { count: contacts?.length ?? 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <ProjectsListSkeleton />
          ) : error ? (
            <div>{t('error')}</div>
          ) : contacts && contacts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onDelete={() => setDeleteTarget({ id: contact.id, name: contact.name })}
                  t={t}
                  getCategoryLabel={getCategoryLabel}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{t('empty.helpText')}</p>
                <Button asChild>
                  <LocaleLink href="/contacts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.addFirst')}
                  </LocaleLink>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-4">
          <ContactsTeamTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ContactCardProps {
  contact: Contact
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
  getCategoryLabel: (category: SupplierCategory) => string
}

function ContactCard({ contact, onDelete, t, getCategoryLabel }: ContactCardProps) {
  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="min-h-[96px]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2 line-clamp-1">
              {contact.name}
              {!contact.is_active && (
                <Badge variant="outline" className="text-xs">{t('card.inactive')}</Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {getCategoryLabel(contact.category)}
              </Badge>
              <Badge className={PLATFORM_STATUS_COLORS[contact.platform_status]}>
                {t(`card.platform.${contact.platform_status}`)}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4">
        <div className="space-y-2 text-sm">
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{contact.project_count} {t('card.projects')}</span>
          </div>
          {contact.total_spent_cents > 0 && (
            <span>{formatCurrency(contact.total_spent_cents)}</span>
          )}
        </div>

        <div className="flex gap-2 pt-2 mt-auto">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <LocaleLink href={`/contacts/${contact.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('card.view')}
            </LocaleLink>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <LocaleLink href={`/contacts/${contact.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {t('card.edit')}
            </LocaleLink>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
