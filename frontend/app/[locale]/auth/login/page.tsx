'use client'

import { useState } from 'react'
import { login } from '../actions'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const locale = useLocale()
  const basePath = `/${locale}`
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const redirectParam = searchParams.get('redirect')
  const redirectTo = redirectParam || (token ? `${basePath}/auth/accept-invite?token=${token}` : '')
  const query = new URLSearchParams()
  if (token) query.set('token', token)
  if (redirectParam) query.set('redirect', redirectParam)
  const queryString = query.toString()
  const querySuffix = queryString ? `?${queryString}` : ''
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/20 blur-[120px] motion-reduce:animate-none animate-blob" />
      <div
        className="pointer-events-none absolute bottom-12 left-[-10%] h-80 w-80 rounded-full bg-emerald-400/20 blur-[140px] motion-reduce:animate-none animate-blob"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="pointer-events-none absolute top-24 right-[-5%] h-72 w-72 rounded-full bg-indigo-400/20 blur-[140px] motion-reduce:animate-none animate-blob"
        style={{ animationDelay: '4s' }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-white/10 bg-slate-900/80 text-slate-100 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-3">
            <Button variant="ghost" size="sm" asChild className="w-fit px-0 text-amber-200 hover:text-amber-100">
              <Link href={basePath}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToHome')}
              </Link>
            </Button>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription className="text-slate-400">{t('subtitle')}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 text-destructive-foreground">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <input type="hidden" name="locale" value={locale} />
              {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">{t('email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  required
                  className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">{t('password')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-6">
              <Button type="submit" className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200" disabled={isLoading}>
                {isLoading ? t('signingIn') : t('signIn')}
              </Button>
              <div className="flex justify-between w-full text-sm text-slate-400">
                <Link href={`${basePath}/auth/register${querySuffix}`} className="text-amber-300 hover:text-amber-200">
                  {t('createAccount')}
                </Link>
                <Link href={`${basePath}/auth/forgot-password${querySuffix}`} className="text-amber-300 hover:text-amber-200">
                  {t('forgotPassword')}
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
