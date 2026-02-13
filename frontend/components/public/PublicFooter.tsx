'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locales, localeNames, type Locale } from '@/i18n/config'

export function PublicFooter() {
  const t = useTranslations('publicFooter')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const basePath = `/${locale}`
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
    <footer className="border-t border-slate-200/60 py-8">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 text-center text-sm text-slate-500 md:flex-row md:text-left">
        <div>{t('copyright')}</div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href={`${basePath}/pricing`} className="hover:text-slate-900">{t('links.pricing')}</Link>
          <Link href={`${basePath}/faq`} className="hover:text-slate-900">{t('links.faq')}</Link>
          <Link href={`${basePath}/about`} className="hover:text-slate-900">{t('links.about')}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {tCommon('language')}
          </span>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger size="sm" className="w-[180px] border-slate-300 bg-white/80 text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {locales.map((option) => (
                <SelectItem key={option} value={option}>
                  {localeNames[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </footer>
  )
}
