'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const router = useRouter()
  const locale = useLocale()
  const { user, profile, refreshProfile, isLoading: authLoading } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.organization_id) {
      router.replace(`/${locale}/dashboard`)
    }
  }, [profile, router, locale])

  useEffect(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    const name = typeof meta?.company_name === 'string' ? meta?.company_name : ''
    if (name) {
      setCompanyName(name)
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (profile?.organization_id) {
        router.replace(`/${locale}/dashboard`)
        return
      }

      await apiClient.post('/api/v1/organizations/onboarding', {
        name: companyName,
      })
      toast.success('Organization created. Welcome!')
      await refreshProfile()
      router.replace(`/${locale}/dashboard`)
    } catch (err: any) {
      const message = err?.message || 'Failed to create organization'
      setError(message)
      if (typeof message === 'string' && message.toLowerCase().includes('already belongs')) {
        await refreshProfile()
        router.replace(`/${locale}/dashboard`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Checking your organization status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-slate-400 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to SafeTasks</CardTitle>
          <CardDescription>Create your production company profile to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                name="company_name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your production company"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Continue'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
