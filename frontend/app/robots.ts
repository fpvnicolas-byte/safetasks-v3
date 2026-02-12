import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/seo'

const INTERNAL_DISALLOW_PATHS = [
  '/*/auth',
  '/*/onboarding',
  '/*/payment',
  '/*/dashboard',
  '/*/projects',
  '/*/financials',
  '/*/settings',
  '/*/contacts',
  '/*/clients',
  '/*/inventory',
  '/*/scenes',
  '/*/characters',
  '/*/proposals',
  '/*/shooting-days',
  '/*/storage',
  '/*/notifications',
  '/*/ai',
  '/*/team',
  '/*/test-auth',
  '/*/test-hooks',
]

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: INTERNAL_DISALLOW_PATHS,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
