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
  Settings,
  Calendar,
  Briefcase,
  Box,
  Sparkles,
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
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

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Sidebar */}
      <aside
        className={`fixed left-0 top-0 w-64 h-full bg-white dark:bg-slate-900 border-r z-50 shadow-lg
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <LocaleLink
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                    'min-h-[44px] min-w-[44px] p-3', // Touch target optimization
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
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-sm transition-all duration-300 ease-in-out z-40"
          onClick={onClose}
        />
      )}
    </>
  )
}