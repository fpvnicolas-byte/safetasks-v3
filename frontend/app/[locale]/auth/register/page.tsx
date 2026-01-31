'use client'

import { useMemo, useState } from 'react'
import { signup } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')

  const passwordScore = useMemo(() => {
    let score = 0
    if (password.length >= 8) score += 1
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
    if (/\d/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score
  }, [password])

  const strengthLabel = useMemo(() => {
    if (!password) return t('passwordStrength.empty')
    if (passwordScore <= 1) return t('passwordStrength.weak')
    if (passwordScore === 2) return t('passwordStrength.fair')
    if (passwordScore === 3) return t('passwordStrength.good')
    return t('passwordStrength.strong')
  }, [password, passwordScore, t])

  const strengthColor = useMemo(() => {
    if (!password) return 'bg-slate-700/70'
    if (passwordScore <= 1) return 'bg-yellow-400'
    if (passwordScore === 2) return 'bg-orange-400'
    return 'bg-emerald-400'
  }, [password, passwordScore])

  const strengthWidth = useMemo(() => {
    if (!password) return 0
    return Math.min(100, (passwordScore + 1) * 25)
  }, [password, passwordScore])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    // Validate password match
    if (formData.get('password') !== formData.get('confirm_password')) {
      setError(t('passwordsDoNotMatch'))
      setIsLoading(false)
      return
    }

    const result = await signup(formData)

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
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-slate-200">{t('fullName')}</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder={t('fullNamePlaceholder')}
                  required
                  className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-slate-200">Company Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  type="text"
                  placeholder="Your production company"
                  required
                  className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
                />
              </div>
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
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{t('passwordStrength.label')}</span>
                  <span className="uppercase tracking-[0.2em]">{strengthLabel}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800/80">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${strengthWidth}%` }}
                  />
                </div>
              </div>
            </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-slate-200">{t('confirmPassword')}</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  minLength={8}
                  required
                  className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-300"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200" disabled={isLoading}>
                {isLoading ? t('creatingAccount') : t('createAccount')}
              </Button>
              <div className="text-sm text-center text-slate-400">
                {t('alreadyHaveAccount')}{' '}
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
