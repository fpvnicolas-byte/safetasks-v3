'use client'

import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationsBell } from '@/components/NotificationsBell'
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

interface HeaderProps {
  onSidebarToggle: () => void
}

export function Header({ onSidebarToggle }: HeaderProps) {
  const { user, signOut } = useAuth()
  const t = useTranslations('navigation')
  const tHeader = useTranslations('header')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

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
        <LocaleLink href="/dashboard" className="inline-flex font-display text-xl font-semibold tracking-tight md:text-2xl">
          <span className="md:hidden">SafeTasks</span>
          <span className="hidden md:inline">SafeTasks V3</span>
        </LocaleLink>

        <nav className="hidden md:flex gap-6 ml-6">
          <LocaleLink
            href="/dashboard"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            {t('dashboard')}
          </LocaleLink>
          <LocaleLink
            href="/projects"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            {t('projects')}
          </LocaleLink>
          <LocaleLink
            href="/call-sheets"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            {t('callSheets')}
          </LocaleLink>
          <LocaleLink
            href="/financials"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            {t('financials')}
          </LocaleLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile Navigation Toggle */}
          <button
            onClick={onSidebarToggle}
            className="md:hidden p-2 rounded-md hover:bg-muted"
          >
            <Menu className="h-6 w-6" />
          </button>

          {user && <NotificationsBell />}
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
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
