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

  { key: 'financials', href: '/financials', icon: DollarSign },
  { key: 'shootingDays', href: '/shooting-days', icon: Calendar },
  { key: 'production', href: '/production', icon: Film },
  { key: 'inventory', href: '/inventory/items', icon: Box },
  { key: 'clients', href: '/clients', icon: Users },
  { key: 'stakeholders', href: '/stakeholders', icon: Users },
  { key: 'suppliers', href: '/suppliers', icon: Briefcase },
  { key: 'settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  return (
    <div className="hidden md:block fixed left-0 top-0 z-40 h-screen w-4 group/sidebar">
      <div className="absolute left-0 top-0 h-full w-4 bg-gradient-to-r from-sidebar/70 to-transparent opacity-40 transition-opacity duration-200 group-hover/sidebar:opacity-80" />
      <aside
        className="absolute left-0 top-0 h-screen w-[288px] border-r border-sidebar-border bg-sidebar/85 text-sidebar-foreground backdrop-blur-xl shadow-lg
        -translate-x-full transition-transform duration-300 ease-out group-hover/sidebar:translate-x-0"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Menu</h2>
          </div>
          <nav className="space-y-1 h-full overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <LocaleLink
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                    'min-h-[44px] min-w-[44px] p-3',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.key)}
                </LocaleLink>
              )
            })}
          </nav>
        </div>
      </aside>
    </div>
  )
}
