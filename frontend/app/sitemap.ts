import type { MetadataRoute } from 'next'

import { locales } from '@/i18n/config'
import {
  PUBLIC_INDEXABLE_PATHS,
  getAbsoluteLocaleUrl,
  getLanguageAlternates,
} from '@/lib/seo'

const PAGE_CONFIG: Record<(typeof PUBLIC_INDEXABLE_PATHS)[number], { priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = {
  '': {
    priority: 1,
    changeFrequency: 'weekly',
  },
  '/pricing': {
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  '/faq': {
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  '/about': {
    priority: 0.6,
    changeFrequency: 'monthly',
  },
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PUBLIC_INDEXABLE_PATHS.flatMap((path) =>
    locales.map((locale) => ({
      url: getAbsoluteLocaleUrl(locale, path),
      lastModified,
      changeFrequency: PAGE_CONFIG[path].changeFrequency,
      priority: PAGE_CONFIG[path].priority,
      alternates: {
        languages: getLanguageAlternates(path),
      },
    }))
  )
}
