'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import {
  Plus,
  FolderPlus,
  FileText,
  DollarSign,
  Calendar,
  Package,
  Users
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'

export function QuickActions() {
  const t = useTranslations('dashboard')
  const actions = [
    {
      title: t('actions.newProject.title'),
      description: t('actions.newProject.desc'),
      icon: <FolderPlus className="h-5 w-5" />,
      href: '/projects/new',
      color: 'bg-blue-100 text-blue-600 hover:bg-blue-200'
    },
    {
      title: t('actions.createInvoice.title'),
      description: t('actions.createInvoice.desc'),
      icon: <FileText className="h-5 w-5" />,
      href: '/financials/new-invoice',
      color: 'bg-green-100 text-green-600 hover:bg-green-200'
    },
    {
      title: t('actions.recordTransaction.title'),
      description: t('actions.recordTransaction.desc'),
      icon: <DollarSign className="h-5 w-5" />,
      href: '/financials/transactions/new',
      color: 'bg-purple-100 text-purple-600 hover:bg-purple-200'
    },
    {
      title: t('actions.callSheet.title'),
      description: t('actions.callSheet.desc'),
      icon: <Calendar className="h-5 w-5" />,
      href: '/call-sheets/new',
      color: 'bg-orange-100 text-orange-600 hover:bg-orange-200'
    },
    {
      title: t('actions.addEquipment.title'),
      description: t('actions.addEquipment.desc'),
      icon: <Package className="h-5 w-5" />,
      href: '/inventory/items/new',
      color: 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
    },
    {
      title: t('actions.addStakeholder.title'),
      description: t('actions.addStakeholder.desc'),
      icon: <Users className="h-5 w-5" />,
      href: '/stakeholders/new',
      color: 'bg-pink-100 text-pink-600 hover:bg-pink-200'
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quickActions')}</CardTitle>
        <CardDescription>{t('commonTasks')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <LocaleLink key={action.href} href={action.href}>
              <div className="group border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${action.color} transition-colors`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                      {action.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </div>
            </LocaleLink>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
