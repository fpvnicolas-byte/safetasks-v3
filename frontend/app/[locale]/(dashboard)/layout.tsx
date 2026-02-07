'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { TrialBanner } from '@/components/billing/TrialBanner'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, isLoading } = useAuth()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'

  const pathWithoutLocale = useMemo(() => {
    const prefix = `/${locale}`
    if (!pathname) return ''
    if (pathname === prefix) return '/'
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length)
    }
    return pathname
  }, [locale, pathname])

  const shouldRedirectFreelancer = useMemo(() => {
    if (isLoading) return false
    if (!profile) return false
    if (effectiveRole !== 'freelancer') return false

    const path = pathWithoutLocale || '/'

    const isAllowed =
      path === '/projects' ||
      path.startsWith('/projects/') ||
      path === '/call-sheets' ||
      path.startsWith('/call-sheets/') ||
      path === '/shooting-days' ||
      path.startsWith('/shooting-days/') ||
      path === '/scenes' ||
      path.startsWith('/scenes/') ||
      path === '/characters' ||
      path.startsWith('/characters/') ||
      path === '/settings' ||
      path.startsWith('/settings/profile') ||
      path === '/notifications' ||
      path.startsWith('/notifications/')

    if (!isAllowed) return true

    // Block create/edit routes for freelancer.
    if (path === '/projects/new' || path.startsWith('/projects/new/')) return true
    if (/^\/projects\/[^/]+\/edit(\/|$)/.test(path)) return true

    if (path === '/call-sheets/new' || path.startsWith('/call-sheets/new/')) return true
    if (/^\/call-sheets\/[^/]+\/edit(\/|$)/.test(path)) return true

    if (path === '/shooting-days/new' || path.startsWith('/shooting-days/new/')) return true
    if (/^\/shooting-days\/[^/]+\/edit(\/|$)/.test(path)) return true

    if (path === '/scenes/new' || path.startsWith('/scenes/new/')) return true
    if (/^\/scenes\/[^/]+\/edit(\/|$)/.test(path)) return true

    if (path === '/characters/new' || path.startsWith('/characters/new/')) return true
    if (/^\/characters\/[^/]+\/edit(\/|$)/.test(path)) return true

    // Allow only Profile (and root) under settings.
    if (path.startsWith('/settings/') && !path.startsWith('/settings/profile')) return true

    return false
  }, [effectiveRole, isLoading, pathWithoutLocale, profile])

  useEffect(() => {
    if (shouldRedirectFreelancer) {
      router.replace(`/${locale}/projects`)
    }
  }, [locale, router, shouldRedirectFreelancer])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (shouldRedirectFreelancer) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Redirecting...
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Navigation */}
        <MobileNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 min-h-screen min-w-0">
          <TrialBanner />
          <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
