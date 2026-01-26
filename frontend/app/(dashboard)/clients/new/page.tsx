'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateClient } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    document: '',
    phone: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createClient = useCreateClient()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required'
    }

    // Optional email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
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
      const clientData = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        document: formData.document.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        organization_id: '4384a92c-df41-444b-b34d-6c80e7820486', // Hardcoded for testing
      }

      await createClient.mutateAsync(clientData)
      router.push('/clients')
    } catch (err: unknown) {
      const error = err as Error
      setErrors({ submit: error.message || 'Failed to create client' })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Client</CardTitle>
            <CardDescription>
              Add a new client to your organization
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errors.submit && (
              <Alert variant="destructive">
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            {/* Name - Required */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Client Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Acme Corporation"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Email - Optional */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="contact@acme.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Document (CPF/CNPJ) - Optional */}
            <div className="space-y-2">
              <Label htmlFor="document">
                Document (CPF/CNPJ/Tax ID)
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => handleInputChange('document', e.target.value)}
                placeholder="12.345.678/0001-90"
              />
              <p className="text-xs text-muted-foreground">
                Tax identification number (CPF for individuals, CNPJ for companies in Brazil)
              </p>
            </div>

            {/* Phone - Optional */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? 'Creating...' : 'Create Client'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/clients">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
