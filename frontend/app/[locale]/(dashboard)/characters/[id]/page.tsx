'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useCharacter, useDeleteCharacter } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'

export default function CharacterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('characters.detail')
  const tCommon = useTranslations('common')
  const characterId = params.id as string
  const { profile } = useAuth()

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  const { data: character, isLoading, error } = useCharacter(characterId)
  const deleteCharacter = useDeleteCharacter()

  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete
  } = useConfirmDelete()

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error || !character) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('notFound')}</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    try {
      await deleteCharacter.mutateAsync(characterId)
      router.push(`/${locale}/characters`)
    } catch (err) {
      console.error('Failed to delete character:', err)
      cancelDelete()
    }
  }

  const requestDelete = () => {
    confirmDelete(characterId)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{character.name}</h1>
            <p className="text-muted-foreground">
              {character.actor_name ? t('playedBy', { actor: character.actor_name }) : t('noActor')}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/${locale}/characters/${characterId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon('edit')}
              </Link>
            </Button>
            <Button variant="destructive" onClick={requestDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {tCommon('delete')}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('name')}</div>
              <div className="text-lg">{character.name}</div>
            </div>

            {character.actor_name && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t('actorName')}</div>
                <div className="text-lg">{character.actor_name}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">{t('description')}</div>
            <div className="text-base whitespace-pre-wrap">{character.description}</div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={t('deleteConfirm')}
        loading={deleteCharacter.isPending}
      />
    </div>
  )
}
