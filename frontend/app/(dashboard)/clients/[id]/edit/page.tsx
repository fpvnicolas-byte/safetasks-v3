'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClient, useUpdateClient } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { data: client, isLoading: clientLoading } = useClient(resolvedParams.id)
  const updateClient = useUpdateClient()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    document: '',
    phone: '',
    is_active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when client data loads
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email || '',
        document: client.document || '',
        phone: client.phone || '',
        is_active: client.is_active,
      })
    }
  }, [client])

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
        is_active: formData.is_active,
      }

      await updateClient.mutateAsync({
        clientId: resolvedParams.id,
        data: clientData,
      })
      router.push(`/clients/${resolvedParams.id}`)
    } catch (err: unknown) {
      const error = err as Error
      setErrors({ submit: error.message || 'Failed to update client' })
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (clientLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!client) {
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Client not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/clients/${resolvedParams.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Client
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Client</CardTitle>
            <CardDescription>
              Update client information for {client.name}
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

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive clients are hidden from most lists but can be reactivated
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={`/clients/${resolvedParams.id}`}>Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
