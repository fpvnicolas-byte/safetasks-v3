'use client'

import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Settings, LogOut, Menu } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { locales, localeNames, type Locale } from '@/i18n/config'

const NotificationsBell = dynamic(
  () => import('@/components/NotificationsBell').then((mod) => mod.NotificationsBell),
  {
    ssr: false,
    loading: () => <div className="h-9 w-9" aria-hidden="true" />,
  }
)

interface HeaderProps {
  onSidebarToggle: () => void
}

type Role = 'owner' | 'admin' | 'producer' | 'finance' | 'freelancer'

export function Header({ onSidebarToggle }: HeaderProps) {
  const { user, signOut, profile } = useAuth()
  const t = useTranslations('navigation')
  const tHeader = useTranslations('header')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const effectiveRole = (profile?.effective_role || profile?.role_v2 || 'owner') as Role
  const homeHref = effectiveRole === 'freelancer' ? '/projects' : '/dashboard'

  const desktopNav = [
    { key: 'dashboard', href: '/dashboard', roles: ['owner', 'admin', 'producer', 'finance'] },
    { key: 'projects', href: '/projects', roles: ['owner', 'admin', 'producer', 'finance', 'freelancer'] },
    { key: 'financials', href: '/financials', roles: ['owner', 'admin', 'finance'] },
  ] satisfies Array<{ key: string; href: string; roles: Role[] }>

  const visibleDesktopNav = desktopNav.filter((item) => item.roles.includes(effectiveRole))

  const buildLocalePath = (nextLocale: Locale) => {
    const segments = pathname.split('/')
    if (segments.length > 1) {
      segments[1] = nextLocale
      return segments.join('/')
    }
    return `/${nextLocale}`
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return
    const nextPath = buildLocalePath(nextLocale as Locale)
    const queryString = searchParams.toString()
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    router.push(`${nextPath}${queryString ? `?${queryString}` : ''}${hash}`)
  }

  return (
    <header className="border-b">
      <div className="flex h-14 items-center px-4 gap-4 md:h-16">
        <LocaleLink href={homeHref} className="inline-flex font-display text-xl font-semibold tracking-tight md:text-2xl">
          <span className="md:hidden">Produzo</span>
          <span className="hidden md:inline">Produzo</span>
        </LocaleLink>

        <nav className="hidden md:flex gap-6 ml-6">
          {visibleDesktopNav.map((item) => (
            <LocaleLink
              key={item.key}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {t(item.key)}
            </LocaleLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile Navigation Toggle */}
          <button
            onClick={onSidebarToggle}
            aria-label={t('openMenu')}
            className="md:hidden p-2 rounded-md hover:bg-muted"
          >
            <Menu className="h-6 w-6" />
          </button>

          {user && <NotificationsBell />}
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={tHeader('userMenu')}>
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <LocaleLink href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {t('settings')}
                  </LocaleLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {tCommon('language')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
                  {locales.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {localeNames[option]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {tHeader('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
