'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, User, Bell, Key, Briefcase, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locales, localeNames, type Locale } from '@/i18n/config'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildLocalePath = (nextLocale: Locale) => {
    const segments = pathname.split('/')
    if (segments.length > 1) {
      segments[1] = nextLocale
      return segments.join('/')
    }
    return `/${nextLocale}`
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return
    const nextPath = buildLocalePath(nextLocale as Locale)
    const queryString = searchParams.toString()
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    router.push(`${nextPath}${queryString ? `?${queryString}` : ''}${hash}`)
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings / Workspace
        </div>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/settings/organization">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-info/15 rounded-lg">
                  <Building2 className="h-6 w-6 text-info" />
                </div>
                <div>
                  <CardTitle>{t('main.organization.title')}</CardTitle>
                  <CardDescription>{t('main.organization.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('main.organization.content')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/profile">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-success/15 rounded-lg">
                  <User className="h-6 w-6 text-success" />
                </div>
                <div>
                  <CardTitle>{t('main.profile.title')}</CardTitle>
                  <CardDescription>{t('main.profile.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('main.profile.content')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/google-drive">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/15 rounded-lg">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('main.googleDrive.title')}</CardTitle>
                  <CardDescription>{t('main.googleDrive.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('main.googleDrive.content')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/services">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary/60 rounded-lg">
                  <Briefcase className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle>{t('main.services.title')}</CardTitle>
                  <CardDescription>{t('main.services.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('main.services.content')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/billing">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/15 rounded-lg">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Billing & Usage</CardTitle>
                  <CardDescription>Manage subscription and usage</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View your current plan, usage limits, and upgrade options
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notifications">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-warning/20 rounded-lg">
                  <Bell className="h-6 w-6 text-warning-foreground" />
                </div>
                <div>
                  <CardTitle>{t('main.notifications.title')}</CardTitle>
                  <CardDescription>{t('main.notifications.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('main.notifications.content')}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <footer className="border-t pt-6">
        <div className="flex flex-col items-start justify-between gap-4 text-sm text-muted-foreground md:flex-row md:items-center">
          <div className="text-xs uppercase tracking-[0.2em]">
            {tCommon('language')}
          </div>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {locales.map((option) => (
                <SelectItem key={option} value={option}>
                  {localeNames[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </footer>
    </div>
  )
}
