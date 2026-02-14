'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PublicHeaderProps {
  /** Extra nav items to show before the standard links (e.g., landing page section anchors) */
  extraNav?: React.ReactNode
}

export function PublicHeader({ extraNav }: PublicHeaderProps) {
  const t = useTranslations('landing')
  const locale = useLocale()
  const basePath = `/${locale}`

  return (
    <header className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
      <div className="flex items-center gap-3">
        <Link href={basePath} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-300 shadow-lg">
            <Clapperboard className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Produzo</div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Production OS</div>
          </div>
        </Link>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 md:justify-end">
        {extraNav}
        <Link href={`${basePath}/pricing`} className="hover:text-slate-900">{t('nav.pricing')}</Link>
        <Link href={`${basePath}/faq`} className="hover:text-slate-900">{t('nav.faq')}</Link>
        <Link href={`${basePath}/about`} className="hover:text-slate-900">{t('nav.about')}</Link>
        <Link href={`${basePath}/auth/login`} className="hover:text-slate-900">{t('nav.signIn')}</Link>
        <Button asChild size="sm" className="bg-slate-900 text-amber-200 hover:bg-slate-800">
          <Link href={`${basePath}/auth/register`}>{t('nav.getStarted')}</Link>
        </Button>
      </nav>
    </header>
  )
}
