import type { Metadata } from 'next'

import { getValidLocale } from '@/i18n/config'
import {
  SITE_NAME,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
  getSeoCopy,
} from '@/lib/seo'

import AboutPageClient from '../../_components/about-page-client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const canonical = getAbsoluteLocaleUrl(locale, '/about')

  return {
    title: seo.aboutTitle,
    description: seo.aboutDescription,
    alternates: {
      canonical,
      languages: getLanguageAlternates('/about'),
    },
    openGraph: {
      title: seo.aboutTitle,
      description: seo.aboutDescription,
      url: canonical,
      siteName: SITE_NAME,
      locale: seo.openGraphLocale,
      type: 'website',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function AboutPage() {
  return <AboutPageClient />
}
