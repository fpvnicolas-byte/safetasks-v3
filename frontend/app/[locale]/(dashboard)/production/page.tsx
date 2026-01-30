'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, FileText, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function ProductionPage() {
  const t = useTranslations('production')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/call-sheets/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newCallSheet')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shooting-days/new">
              <Calendar className="mr-2 h-4 w-4" />
              {t('newShootingDay')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('callSheets.title')}
            </CardTitle>
            <CardDescription>
              {t('callSheets.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/call-sheets">{t('callSheets.viewAll')}</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/call-sheets/new">{t('callSheets.createNew')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('shootingDays.title')}
            </CardTitle>
            <CardDescription>
              {t('shootingDays.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/shooting-days">{t('shootingDays.viewAll')}</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/shooting-days/new">{t('shootingDays.createNew')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t('projects.title')}
            </CardTitle>
            <CardDescription>
              {t('projects.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/projects">{t('projects.viewAll')}</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/projects/new">{t('projects.createNew')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions.title')}</CardTitle>
          <CardDescription>
            {t('quickActions.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/scenes">
                {t('quickActions.manageScenes')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/characters">
                {t('quickActions.manageCharacters')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/inventory/items">
                {t('quickActions.equipmentInventory')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/suppliers">
                {t('quickActions.productionVendors')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
