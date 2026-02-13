'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateCharacter } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function NewCharacterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''
  const { profile } = useAuth()

  const [formData, setFormData] = useState({
    name: '',
    description: '', // REQUIRED by backend
    actor_name: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { errorDialog, showError, closeError } = useErrorDialog()

  const createCharacter = useCreateCharacter()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Character name is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Character description is required'
    }

    if (!projectId) {
      newErrors.project = 'Project is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const characterData = {
        name: formData.name.trim(),
        description: formData.description.trim(), // REQUIRED
        actor_name: formData.actor_name.trim() || undefined,
        project_id: projectId,
      }

      console.log('🚀 Creating character with data (no org_id):', characterData)
      console.log('👤 Profile:', profile)
      console.log('🆔 Organization ID (auto-added by backend):', profile?.organization_id)

      await createCharacter.mutateAsync(characterData)
      router.push('/characters')
    } catch (err: unknown) {
      console.error('Create character error:', err)
      showError(err, 'Error Creating Character')
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/characters">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Characters
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Project is required to create a character</p>
              <Button asChild>
                <Link href="/characters">Go to Characters</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/characters">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Characters
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Create Character</h1>
          <p className="text-muted-foreground">
            Add a new character to your production
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Character Information</CardTitle>
            <CardDescription>
              Enter the details for your new character
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Character Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Character Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter character name"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Description - REQUIRED BY BACKEND */}
            <div className="space-y-2">
              <Label htmlFor="description">Character Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Character background, personality, role in story..."
                rows={4}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Required: Character details, personality, role, or any relevant information
              </p>
            </div>

            {/* Actor Name */}
            <div className="space-y-2">
              <Label htmlFor="actor_name">Actor Name</Label>
              <Input
                id="actor_name"
                value={formData.actor_name}
                onChange={(e) => handleInputChange('actor_name', e.target.value)}
                placeholder="Enter actor name (optional)"
              />
              <p className="text-xs text-muted-foreground">
                The actor who will play this character
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCharacter.isPending}
            >
              {createCharacter.isPending ? 'Creating...' : 'Create Character'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}

export default function NewCharacterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewCharacterForm />
    </Suspense>
  )
}
