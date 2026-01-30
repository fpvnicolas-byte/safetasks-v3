'use client'

import { LocaleLink } from '@/components/LocaleLink'
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
  Sparkles,
} from 'lucide-react'

import { useTranslations } from 'next-intl'

const navigation = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'ai', href: '/ai', icon: Sparkles },
  { key: 'projects', href: '/projects', icon: FolderOpen },
  { key: 'proposals', href: '/proposals', icon: FileText },
  { key: 'callSheets', href: '/call-sheets', icon: FileText },
  { key: 'financials', href: '/financials', icon: DollarSign },
  { key: 'shootingDays', href: '/shooting-days', icon: Calendar },
  { key: 'production', href: '/production', icon: Film },
  { key: 'inventory', href: '/inventory/items', icon: Box },
  { key: 'clients', href: '/clients', icon: Users },
  { key: 'suppliers', href: '/suppliers', icon: Briefcase },
  { key: 'settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  return (
    <aside className="w-[288px] h-screen border-r bg-slate-50 dark:bg-slate-900 
      hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:w-[288px] lg:translate-x-0">
      <nav className="space-y-1 p-4 h-full overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <LocaleLink
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.key)}
            </LocaleLink>
          )
        })}
      </nav>
    </aside>
  )
}
