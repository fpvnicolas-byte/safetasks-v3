import type { Metadata } from 'next'

import { getValidLocale } from '@/i18n/config'
import {
  SITE_NAME,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
  getOpenGraphImagePath,
  getSeoCopy,
  getTwitterImagePath,
} from '@/lib/seo'

import PricingPageClient from '../_components/pricing-page-client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const canonical = getAbsoluteLocaleUrl(locale, '/pricing')
  const ogImage = getOpenGraphImagePath(locale)
  const twitterImage = getTwitterImagePath(locale)

  return {
    title: seo.pricingTitle,
    description: seo.pricingDescription,
    alternates: {
      canonical,
      languages: getLanguageAlternates('/pricing'),
    },
    openGraph: {
      title: seo.pricingTitle,
      description: seo.pricingDescription,
      url: canonical,
      siteName: SITE_NAME,
      locale: seo.openGraphLocale,
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seo.pricingTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.pricingTitle,
      description: seo.pricingDescription,
      images: [twitterImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default function PricingPage() {
  return <PricingPageClient />
}
