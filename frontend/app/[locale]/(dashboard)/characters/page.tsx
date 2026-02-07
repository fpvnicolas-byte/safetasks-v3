'use client'

import { useState } from 'react'
import { useProjects } from '@/lib/api/hooks'
import { useCharacters } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function CharactersPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const { organizationId, profile } = useAuth()
  const t = useTranslations('characters')

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  // Fetch projects for selection
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId || undefined)

  // Fetch characters - only when project is selected
  const { data: characters, isLoading } = useCharacters(selectedProjectId || undefined)

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Cast / Characters
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          {canManage && (
            <Button asChild disabled={!selectedProjectId}>
              <Link href={selectedProjectId ? `/characters/new?project=${selectedProjectId}` : '#'}>
                <Plus className="mr-2 h-4 w-4" />
                {t('newCharacter')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t('projectSelection.title')}</CardTitle>
          <CardDescription>
            {t('projectSelection.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="text-sm text-muted-foreground">{t('projectSelection.loading')}</div>
          ) : projects && projects.length > 0 ? (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t('projectSelection.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t('projectSelection.noProjects')}
              {canManage && (
                <>
                  {' '}
                  <Link href="/projects/new" className="text-info hover:underline">
                    {t('projectSelection.createFirst')}
                  </Link>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Characters List */}
      {selectedProjectId && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">{t('list.loading')}</div>
            </div>
          ) : characters && characters.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => (
                <Link key={character.id} href={`/characters/${character.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">{character.name}</CardTitle>
                      {character.actor_name && (
                        <CardDescription className="text-base">
                          {character.actor_name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {character.description && (
                          <div className="text-muted-foreground line-clamp-2">
                            {character.description}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t('empty.title')}</CardTitle>
                <CardDescription>
                  {t('empty.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">{t('empty.noCharactersYet')}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('empty.helpText')}
                  </p>
                  {canManage && (
                    <Button asChild>
                      <Link href={`/characters/new?project=${selectedProjectId}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('addCharacter')}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
