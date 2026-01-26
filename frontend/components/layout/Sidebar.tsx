'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  DollarSign,
  Film,
  Users,
  Settings,
  Calendar,
  Briefcase,
  Box,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Proposals', href: '/proposals', icon: FileText },
  { name: 'Call Sheets', href: '/call-sheets', icon: FileText },
  { name: 'Financials', href: '/financials', icon: DollarSign },
  { name: 'Shooting Days', href: '/shooting-days', icon: Calendar },
  { name: 'Production', href: '/production', icon: Film },
  { name: 'Inventory', href: '/inventory/items', icon: Box },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Suppliers', href: '/suppliers', icon: Briefcase },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-slate-50 dark:bg-slate-900">
      <nav className="space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
