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
      color: 'bg-info/15 text-info'
    },
    {
      title: t('actions.createInvoice.title'),
      description: t('actions.createInvoice.desc'),
      icon: <FileText className="h-5 w-5" />,
      href: '/financials/new-invoice',
      color: 'bg-success/15 text-success'
    },
    {
      title: t('actions.recordTransaction.title'),
      description: t('actions.recordTransaction.desc'),
      icon: <DollarSign className="h-5 w-5" />,
      href: '/financials/transactions/new',
      color: 'bg-primary/15 text-primary'
    },
    {
      title: t('actions.addEquipment.title'),
      description: t('actions.addEquipment.desc'),
      icon: <Package className="h-5 w-5" />,
      href: '/inventory/items/new',
      color: 'bg-secondary/60 text-secondary-foreground'
    },
    {
      title: t('actions.addContact.title'),
      description: t('actions.addContact.desc'),
      icon: <Users className="h-5 w-5" />,
      href: '/contacts/new',
      color: 'bg-accent text-accent-foreground'
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
              <div className="group flex h-full min-h-[104px] flex-col border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${action.color} transition-colors`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                      {action.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
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
