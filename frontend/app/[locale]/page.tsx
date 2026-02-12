import type { Metadata } from 'next'

import { getValidLocale } from '@/i18n/config'
import {
  SITE_NAME,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
  getLandingOpenGraphImagePath,
  getLandingTwitterImagePath,
  getSeoCopy,
} from '@/lib/seo'
import { getLandingJsonLd } from '@/lib/structured-data'

import LandingPageClient from './_components/landing-page-client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const canonical = getAbsoluteLocaleUrl(locale)
  const ogImage = getLandingOpenGraphImagePath(locale)
  const twitterImage = getLandingTwitterImagePath(locale)

  return {
    title: seo.landingTitle,
    description: seo.landingDescription,
    alternates: {
      canonical,
      languages: getLanguageAlternates(''),
    },
    openGraph: {
      title: seo.landingTitle,
      description: seo.landingDescription,
      url: canonical,
      siteName: SITE_NAME,
      locale: seo.openGraphLocale,
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seo.landingTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.landingTitle,
      description: seo.landingDescription,
      images: [twitterImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function LandingPage({ params }: PageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const jsonLdNodes = getLandingJsonLd(locale)

  return (
    <>
      {jsonLdNodes.map((node, index) => (
        <script
          key={`landing-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
      <LandingPageClient />
    </>
  )
}
