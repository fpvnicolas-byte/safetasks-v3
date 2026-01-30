'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useScene, useDeleteScene } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'

export default function SceneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('scenes.detail')
  const tCommon = useTranslations('common')
  const sceneId = params.id as string

  const { data: scene, isLoading, error } = useScene(sceneId)
  const deleteScene = useDeleteScene()

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error || !scene) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('notFound')}</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      await deleteScene.mutateAsync(sceneId)
      router.push(`/${locale}/scenes`)
    } catch (err) {
      console.error('Failed to delete scene:', err)
    }
  }

  const timeVariant: Record<string, 'warning' | 'secondary' | 'outline'> = {
    day: 'warning',
    night: 'secondary',
    dawn: 'outline',
    dusk: 'outline',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-display">{t('title', { number: scene.scene_number })}</h1>
            <p className="text-muted-foreground">{scene.heading}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/scenes/${sceneId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {tCommon('edit')}
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('location')}</div>
              <div className="text-lg">{scene.internal_external}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('time')}</div>
              <div className="text-lg">
                <Badge variant={timeVariant[scene.day_night] ?? 'outline'}>
                  {scene.day_night}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('duration')}</div>
              <div className="text-lg">{scene.estimated_time_minutes} {t('minutes')}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">{t('description')}</div>
            <div className="text-base whitespace-pre-wrap">{scene.description}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
