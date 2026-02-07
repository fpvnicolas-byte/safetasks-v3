'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useScenes, useDeleteScene } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Film, Clock, MapPin, Eye } from 'lucide-react'
import Link from 'next/link'
import { Scene } from '@/types'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

const locationVariant: Record<string, 'info' | 'success'> = {
  internal: 'info',
  external: 'success',
}

const timeOfDayVariant: Record<string, 'warning' | 'secondary' | 'outline'> = {
  day: 'warning',
  night: 'secondary',
  dawn: 'outline',
  dusk: 'outline',
}

function ScenesContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''
  const t = useTranslations('scenes')
  const { profile } = useAuth()

  const [locationFilter, setLocationFilter] = useState<string | 'all'>('all')
  const [timeOfDayFilter, setTimeOfDayFilter] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  // Get scenes data
  const { data: allScenes, isLoading, error } = useScenes(projectId)
  const deleteScene = useDeleteScene()

  // Apply filters
  const filteredScenes = allScenes?.filter(scene => {
    const matchesLocation = locationFilter === 'all' || scene.internal_external === locationFilter
    const matchesTimeOfDay = timeOfDayFilter === 'all' || scene.day_night === timeOfDayFilter
    const matchesSearch = !searchQuery ||
      scene.scene_number.toString().includes(searchQuery.toLowerCase()) ||
      scene.description.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesLocation && matchesTimeOfDay && matchesSearch
  }) || []

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, number: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteScene = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteScene.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      alert(t('list.deleteError', { message: error.message }))
    } finally {
      setIsDeleting(false)
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('noProjectContext.title')}</h1>
          <p className="text-muted-foreground">
            {t('noProjectContext.description')}
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('noProjectContext.message')}
              </p>
              <Button asChild>
                <Link href="/projects">{t('noProjectContext.goToProjects')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteScene}
        loading={isDeleting}
        title={t('list.deleteConfirm', { number: deleteTarget?.number || '' })}
        description={t('list.deleteConfirm', { number: deleteTarget?.number || '' })}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href={`/scenes/new?project=${projectId}`}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newScene')}
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filter.title')}</CardTitle>
          <CardDescription>
            {t('filter.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('filter.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.location')}</label>
              <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value as string | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allLocations')}</SelectItem>
                  <SelectItem value="internal">{t('interior')}</SelectItem>
                  <SelectItem value="external">{t('exterior')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.timeOfDay')}</label>
              <Select value={timeOfDayFilter} onValueChange={(value) => setTimeOfDayFilter(value as string | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allTimes')}</SelectItem>
                  <SelectItem value="day">{t('day')}</SelectItem>
                  <SelectItem value="night">{t('night')}</SelectItem>
                  <SelectItem value="dawn">{t('dawn')}</SelectItem>
                  <SelectItem value="dusk">{t('dusk')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.results')}</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredScenes.length !== 1 ? t('filter.sceneCount_other', { count: filteredScenes.length }) : t('filter.sceneCount', { count: 1 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenes Grid */}
      {isLoading ? (
        <div>{t('list.loading')}</div>
      ) : error ? (
        <div>{t('list.error', { message: error.message })}</div>
      ) : filteredScenes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onDelete={() => setDeleteTarget({ id: scene.id, number: scene.scene_number.toString() })}
              t={t}
              canManage={canManage}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('empty.title')}</CardTitle>
            <CardDescription>
              {searchQuery || locationFilter !== 'all' || timeOfDayFilter !== 'all'
                ? t('empty.noMatches')
                : t('empty.getStarted')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('empty.helpText')}
              </p>
              {canManage && (
                <Button asChild>
                  <Link href={`/scenes/new?project=${projectId}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.createFirst')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface SceneCardProps {
  scene: Scene
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
  canManage: boolean
}

function SceneCard({ scene, onDelete, t, canManage }: SceneCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {t('title')} {scene.scene_number}
            </CardTitle>
            <CardDescription className="font-medium">
              {scene.description.split('.')[0] || t('list.noDescription')}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Badge variant={locationVariant[scene.internal_external] ?? 'outline'}>
              {t(scene.internal_external)}
            </Badge>
            <Badge variant={timeOfDayVariant[scene.day_night] ?? 'outline'}>
              {t(scene.day_night)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {scene.description}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {scene.estimated_time_minutes ? `${scene.estimated_time_minutes} min` : t('list.noEstimate')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {scene.estimated_time_minutes ? `${scene.estimated_time_minutes} min` : t('list.noDuration')}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/scenes/${scene.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('list.view')}
            </Link>
          </Button>
          {canManage && (
            <>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/scenes/${scene.id}/edit`}>
                  <Edit className="mr-2 h-3 w-3" />
                  {t('list.edit')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ScenesPage() {
  const t = useTranslations('common.feedback')

  return (
    <Suspense fallback={<div>{t('loading')}</div>}>
      <ScenesContent />
    </Suspense>
  )
}
