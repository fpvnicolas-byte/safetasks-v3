'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCharacter, useDeleteCharacter } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DetailPageSkeleton } from '@/components/LoadingSkeletons'

export default function CharacterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const characterId = params.id as string

  const { data: character, isLoading, error } = useCharacter(characterId)
  const deleteCharacter = useDeleteCharacter()

  if (isLoading) {
    return <DetailPageSkeleton />
  }

  if (error || !character) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Character not found</AlertDescription>
      </Alert>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this character?')) return

    try {
      await deleteCharacter.mutateAsync(characterId)
      router.push('/characters')
    } catch (err) {
      console.error('Failed to delete character:', err)
    }
  }

  const roleColors: Record<string, string> = {
    lead: 'bg-purple-100 text-purple-800',
    supporting: 'bg-blue-100 text-blue-800',
    extra: 'bg-gray-100 text-gray-800',
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
              {character.actor_name ? `Played by ${character.actor_name}` : 'No actor assigned'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/characters/${characterId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {character.role_type && (
        <Badge className={roleColors[character.role_type]}>
          {character.role_type.charAt(0).toUpperCase() + character.role_type.slice(1)}
        </Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Character Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Character Name</div>
              <div className="text-lg">{character.name}</div>
            </div>

            {character.actor_name && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Actor Name</div>
                <div className="text-lg">{character.actor_name}</div>
              </div>
            )}
          </div>

          {character.contact_info && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Contact Information</div>
              <div className="text-base whitespace-pre-wrap">{character.contact_info}</div>
            </div>
          )}

          {character.notes && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
              <div className="text-base whitespace-pre-wrap">{character.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
