'use client'

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
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

type Role = 'owner' | 'admin' | 'producer' | 'finance' | 'freelancer'

const ALL_ROLES: Role[] = ['owner', 'admin', 'producer', 'finance', 'freelancer']

const navigation: { key: string; href: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
  { key: 'ai', href: '/ai', icon: Sparkles, roles: ['owner', 'admin', 'producer'] },
  { key: 'projects', href: '/projects', icon: FolderOpen, roles: ['owner', 'admin', 'producer', 'freelancer'] },
  { key: 'proposals', href: '/proposals', icon: FileText, roles: ['owner', 'admin', 'producer'] },
  { key: 'callSheets', href: '/call-sheets', icon: FileText, roles: ['owner', 'admin', 'producer'] },
  { key: 'financials', href: '/financials', icon: DollarSign, roles: ['owner', 'admin', 'finance'] },
  { key: 'shootingDays', href: '/shooting-days', icon: Calendar, roles: ['owner', 'admin', 'producer'] },
  { key: 'production', href: '/production', icon: Film, roles: ['owner', 'admin', 'producer'] },
  { key: 'inventory', href: '/inventory/items', icon: Box, roles: ['owner', 'admin', 'producer'] },
  { key: 'clients', href: '/clients', icon: Users, roles: ['owner', 'admin', 'producer'] },
  { key: 'suppliers', href: '/suppliers', icon: Briefcase, roles: ['owner', 'admin', 'producer'] },
  { key: 'team', href: '/team', icon: UsersRound, roles: ['owner', 'admin', 'producer'] },
  { key: 'settings', href: '/settings', icon: Settings, roles: ALL_ROLES },
]

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const { profile } = useAuth()

  const effectiveRole = (profile?.effective_role || profile?.role_v2 || 'owner') as Role

  const visibleNav = navigation.filter((item) => item.roles.includes(effectiveRole))

  return (
    <>
      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-[18rem] min-w-[16rem] max-w-[85vw] border-r border-sidebar-border bg-sidebar/85 text-sidebar-foreground backdrop-blur-xl z-50 shadow-lg',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <LocaleLink
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
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

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/20 backdrop-blur-sm transition-all duration-300 ease-in-out z-40"
          onClick={onClose}
        />
      )}
    </>
  )
}
