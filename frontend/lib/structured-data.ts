import type { Locale } from '@/i18n/config'

import { SITE_NAME, getAbsoluteLocaleUrl, getSeoCopy, getSiteUrl } from '@/lib/seo'

export type JsonLdNode = Record<string, unknown>

function getLanguageTag(locale: Locale): string {
  return locale === 'pt-br' ? 'pt-BR' : 'en-US'
}

function getPlanNames(locale: Locale): string[] {
  return locale === 'pt-br'
    ? ['Starter', 'Professional', 'Professional Anual', 'Enterprise']
    : ['Starter', 'Professional', 'Professional Annual', 'Enterprise']
}

function getCommonNodes(locale: Locale): JsonLdNode[] {
  const seo = getSeoCopy(locale)
  const siteUrl = getSiteUrl()
  const language = getLanguageTag(locale)

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: SITE_NAME,
      url: siteUrl,
      logo: `${siteUrl}/favicon.ico`,
      description: seo.siteDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: SITE_NAME,
      url: siteUrl,
      inLanguage: language,
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
  ]
}

export function getLandingJsonLd(locale: Locale): JsonLdNode[] {
  const seo = getSeoCopy(locale)
  const siteUrl = getSiteUrl()
  const pageUrl = getAbsoluteLocaleUrl(locale)
  const language = getLanguageTag(locale)

  return [
    ...getCommonNodes(locale),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: seo.landingTitle,
      description: seo.landingDescription,
      inLanguage: language,
      isPartOf: {
        '@id': `${siteUrl}/#website`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#software`,
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description: seo.siteDescription,
      inLanguage: language,
      creator: {
        '@id': `${siteUrl}/#organization`,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ]
}

export function getPricingJsonLd(locale: Locale): JsonLdNode[] {
  const seo = getSeoCopy(locale)
  const siteUrl = getSiteUrl()
  const homeUrl = getAbsoluteLocaleUrl(locale)
  const pricingUrl = getAbsoluteLocaleUrl(locale, '/pricing')
  const language = getLanguageTag(locale)
  const plansLabel = locale === 'pt-br' ? 'Planos SafeTasks' : 'SafeTasks Plans'
  const homeLabel = locale === 'pt-br' ? 'Inicio' : 'Home'
  const pricingLabel = locale === 'pt-br' ? 'Precos' : 'Pricing'

  const offerCatalogItems = getPlanNames(locale).map((planName, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Offer',
      name: planName,
      availability: 'https://schema.org/InStock',
    },
  }))

  return [
    ...getCommonNodes(locale),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pricingUrl}#webpage`,
      url: pricingUrl,
      name: seo.pricingTitle,
      description: seo.pricingDescription,
      inLanguage: language,
      isPartOf: {
        '@id': `${siteUrl}/#website`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#pricing-software`,
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: pricingUrl,
      description: seo.pricingDescription,
      inLanguage: language,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: plansLabel,
        itemListElement: offerCatalogItems,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: homeLabel,
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: pricingLabel,
          item: pricingUrl,
        },
      ],
    },
  ]
}
