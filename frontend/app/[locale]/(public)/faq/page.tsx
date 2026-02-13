import type { Metadata } from 'next'

import { getValidLocale } from '@/i18n/config'
import {
  SITE_NAME,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
  getSeoCopy,
} from '@/lib/seo'

import FaqPageClient from '../../_components/faq-page-client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const canonical = getAbsoluteLocaleUrl(locale, '/faq')

  return {
    title: seo.faqTitle,
    description: seo.faqDescription,
    alternates: {
      canonical,
      languages: getLanguageAlternates('/faq'),
    },
    openGraph: {
      title: seo.faqTitle,
      description: seo.faqDescription,
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

export default async function FaqPage() {
  return <FaqPageClient />
}
