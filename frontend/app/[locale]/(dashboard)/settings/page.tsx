'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, User, Bell, Key, Briefcase, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function SettingsPage() {
  const t = useTranslations('settings')

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
    </div>
  )
}
