import type { Metadata } from 'next'

import { getValidLocale } from '@/i18n/config'
import {
  SITE_NAME,
  getAbsoluteUrl,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
  getOpenGraphLogoPath,
  getPricingOpenGraphImagePath,
  getPricingTwitterImagePath,
  getSeoCopy,
} from '@/lib/seo'
import { getPricingJsonLd } from '@/lib/structured-data'

import PricingPageClient from '../_components/pricing-page-client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const canonical = getAbsoluteLocaleUrl(locale, '/pricing')
  const ogImage = getAbsoluteUrl(getPricingOpenGraphImagePath(locale))
  const ogLogo = getAbsoluteUrl(getOpenGraphLogoPath(locale))
  const twitterImage = getAbsoluteUrl(getPricingTwitterImagePath(locale))

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
        {
          url: ogLogo,
          width: 512,
          height: 512,
          alt: `${SITE_NAME} logo`,
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

export default async function PricingPage({ params }: PageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const jsonLdNodes = getPricingJsonLd(locale)

  return (
    <>
      {jsonLdNodes.map((node, index) => (
        <script
          key={`pricing-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
      <PricingPageClient />
    </>
  )
}
