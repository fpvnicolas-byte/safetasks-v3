'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function ProfileSettingsPage() {
  const { user } = useAuth()
  const t = useTranslations('settings.profilePage')

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>{t('card.title')}</CardTitle>
              <CardDescription>{t('card.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('fields.email')}</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              {t('fields.emailHelp')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('fields.userId')}</Label>
            <Input value={user?.id || ''} disabled className="bg-muted font-mono text-xs" />
          </div>

          <div className="space-y-2">
            <Label>{t('fields.accountStatus')}</Label>
            <div>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {t('fields.active')}
              </Badge>
            </div>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-muted-foreground">
              {t('futureFeatures.intro')}
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>{t('futureFeatures.displayName')}</li>
              <li>{t('futureFeatures.notifications')}</li>
              <li>{t('futureFeatures.languageTimezone')}</li>
              <li>{t('futureFeatures.passwordManagement')}</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" asChild>
              <Link href="/settings">{t('backButton')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
