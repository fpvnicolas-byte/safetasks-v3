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
  UsersRound,
  Settings,
  Calendar,
  Briefcase,
  Box,
  Sparkles,
  Shield,
} from 'lucide-react'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'

type Role = 'owner' | 'admin' | 'producer' | 'finance' | 'freelancer'

const ALL_ROLES: Role[] = ['owner', 'admin', 'producer', 'finance', 'freelancer']

const navigation: { key: string; href: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'producer', 'finance'] },
  { key: 'ai', href: '/ai', icon: Sparkles, roles: ['owner', 'admin', 'producer'] },
  { key: 'projects', href: '/projects', icon: FolderOpen, roles: ['owner', 'admin', 'producer', 'finance', 'freelancer'] },
  { key: 'proposals', href: '/proposals', icon: FileText, roles: ['owner', 'admin', 'producer'] },
  { key: 'financials', href: '/financials', icon: DollarSign, roles: ['owner', 'admin', 'finance'] },
  { key: 'shootingDays', href: '/shooting-days', icon: Calendar, roles: ['owner', 'admin', 'producer'] },
  { key: 'production', href: '/production', icon: Film, roles: ['owner', 'admin', 'producer'] },
  { key: 'inventory', href: '/inventory/items', icon: Box, roles: ['owner', 'admin', 'producer'] },
  { key: 'clients', href: '/clients', icon: Users, roles: ['owner', 'admin', 'producer'] },
  { key: 'contacts', href: '/contacts', icon: UsersRound, roles: ['owner', 'admin', 'producer'] },
  { key: 'settings', href: '/settings', icon: Settings, roles: ALL_ROLES },
]

export function Sidebar() {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const { profile } = useAuth()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)

  const effectiveRole = (profile?.effective_role || profile?.role_v2 || 'owner') as Role

  const visibleNav = navigation.filter((item) => item.roles.includes(effectiveRole))

  useEffect(() => {
    if (!profile) return
    apiClient.get('/api/v1/platform/bug-reports/?limit=1')
      .then(() => setIsPlatformAdmin(true))
      .catch(() => setIsPlatformAdmin(false))
  }, [profile])

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
            {visibleNav.map((item) => {
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
            {isPlatformAdmin && (
              <LocaleLink
                href="/platform"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                  'min-h-[44px] min-w-[44px] p-3 mt-2 border-t border-sidebar-border pt-3',
                  pathname.startsWith('/platform')
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                )}
              >
                <Shield className="h-5 w-5" />
                <span className="flex items-center gap-2">
                  {t('platform')}
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    Super
                  </Badge>
                </span>
              </LocaleLink>
            )}
          </nav>
        </div>
      </aside>
    </div>
  )
}
