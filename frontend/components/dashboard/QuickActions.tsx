'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  FolderPlus,
  FileText,
  DollarSign,
  Calendar,
  Package,
  Users
} from 'lucide-react'
import Link from 'next/link'

export function QuickActions() {
  const actions = [
    {
      title: 'New Project',
      description: 'Start a new film project',
      icon: <FolderPlus className="h-5 w-5" />,
      href: '/projects/new',
      color: 'bg-blue-100 text-blue-600 hover:bg-blue-200'
    },
    {
      title: 'Create Invoice',
      description: 'Bill a client',
      icon: <FileText className="h-5 w-5" />,
      href: '/financials/new-invoice',
      color: 'bg-green-100 text-green-600 hover:bg-green-200'
    },
    {
      title: 'Record Transaction',
      description: 'Log income or expense',
      icon: <DollarSign className="h-5 w-5" />,
      href: '/financials/transactions/new',
      color: 'bg-purple-100 text-purple-600 hover:bg-purple-200'
    },
    {
      title: 'Call Sheet',
      description: 'Create production schedule',
      icon: <Calendar className="h-5 w-5" />,
      href: '/call-sheets/new',
      color: 'bg-orange-100 text-orange-600 hover:bg-orange-200'
    },
    {
      title: 'Add Equipment',
      description: 'Register new kit item',
      icon: <Package className="h-5 w-5" />,
      href: '/inventory/items/new',
      color: 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
    },
    {
      title: 'Add Stakeholder',
      description: 'Add team member',
      icon: <Users className="h-5 w-5" />,
      href: '/stakeholders/new',
      color: 'bg-pink-100 text-pink-600 hover:bg-pink-200'
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
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
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
