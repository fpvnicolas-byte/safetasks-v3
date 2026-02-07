'use client'

import { useState } from 'react'
import { resetPassword } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await resetPassword(formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
    }

    setIsLoading(false)
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
          <CardHeader>
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
              {success && (
                <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-6">
              <Button type="submit" className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200" disabled={isLoading}>
                {isLoading ? t('sending') : t('sendResetLink')}
              </Button>
              <div className="text-sm text-center text-slate-400">
                {t('rememberPassword')}{' '}
                <Link href="/auth/login" className="text-amber-300 hover:text-amber-200">
                  {t('signIn')}
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
