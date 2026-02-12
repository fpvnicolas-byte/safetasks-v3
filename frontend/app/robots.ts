import type { MetadataRoute } from 'next'

import { locales } from '@/i18n/config'
import { getSiteUrl } from '@/lib/seo'

const INTERNAL_PREFIXES = [
  '/auth',
  '/onboarding',
  '/payment',
  '/dashboard',
  '/projects',
  '/financials',
  '/settings',
  '/contacts',
  '/clients',
  '/inventory',
  '/scenes',
  '/characters',
  '/proposals',
  '/shooting-days',
  '/storage',
  '/notifications',
  '/ai',
  '/team',
  '/test-auth',
  '/test-hooks',
] as const

function getDisallowRules(): string[] {
  return locales.flatMap((locale) =>
    INTERNAL_PREFIXES.flatMap((prefix) => [
      `/${locale}${prefix}`,
      `/${locale}${prefix}/`,
      `/${locale}${prefix}/*`,
    ])
  )
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: getDisallowRules(),
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
