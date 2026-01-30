'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, User, Bell, Key, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function SettingsPage() {
  const t = useTranslations('settings')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/settings/organization">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <User className="h-6 w-6 text-green-600 dark:text-green-400" />
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
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Key className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
                <div className="p-3 bg-pink-100 dark:bg-pink-900 rounded-lg">
                  <Briefcase className="h-6 w-6 text-pink-600 dark:text-pink-400" />
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

        <Link href="/notifications">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Bell className="h-6 w-6 text-orange-600 dark:text-orange-400" />
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
