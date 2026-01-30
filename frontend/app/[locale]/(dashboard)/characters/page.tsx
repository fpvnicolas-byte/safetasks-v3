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

export default function CharactersPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const { organizationId } = useAuth()

  // Fetch projects for selection
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId || undefined)

  // Fetch characters - only when project is selected
  const { data: characters, isLoading } = useCharacters(selectedProjectId || undefined)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Characters</h1>
          <p className="text-muted-foreground">
            Manage your film production characters and cast
          </p>
        </div>
        <Button asChild disabled={!selectedProjectId}>
          <Link href={selectedProjectId ? `/characters/new?project=${selectedProjectId}` : '#'}>
            <Plus className="mr-2 h-4 w-4" />
            New Character
          </Link>
        </Button>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
          <CardDescription>
            Choose a project to view and manage its characters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="text-sm text-muted-foreground">Loading projects...</div>
          ) : projects && projects.length > 0 ? (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a project" />
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
              No projects found. <Link href="/projects/new" className="text-blue-600 hover:underline">Create a project</Link> first.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Characters List */}
      {selectedProjectId && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">Loading characters...</div>
            </div>
          ) : characters && characters.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => (
                <Link key={character.id} href={`/characters/${character.id}`}>
                  <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
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
                <CardTitle>No Characters Found</CardTitle>
                <CardDescription>
                  This project doesn&apos;t have any characters yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No characters yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building your cast by adding the first character
                  </p>
                  <Button asChild>
                    <Link href={`/characters/new?project=${selectedProjectId}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Character
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
