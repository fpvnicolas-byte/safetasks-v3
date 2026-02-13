import { defaultLocale, locales, type Locale } from '@/i18n/config'

const DEFAULT_SITE_URL = 'https://safetasks.vercel.app'

export const SITE_NAME = 'SafeTasks'

export const PUBLIC_INDEXABLE_PATHS = ['', '/pricing', '/faq', '/about'] as const

const STATIC_OG_IMAGES: Record<Locale, { landing: string; pricing: string }> = {
  en: {
    landing: '/og/og-home-en.png',
    pricing: '/og/og-pricing-en.png',
  },
  'pt-br': {
    landing: '/og/og-home-ptbr.png',
    pricing: '/og/og-pricing-ptbr.png',
  },
}

interface LocaleSeoCopy {
  siteTitle: string
  siteDescription: string
  landingTitle: string
  landingDescription: string
  pricingTitle: string
  pricingDescription: string
  faqTitle: string
  faqDescription: string
  aboutTitle: string
  aboutDescription: string
  openGraphLocale: string
}

const SEO_COPY: Record<Locale, LocaleSeoCopy> = {
  en: {
    siteTitle: 'SafeTasks | Film Production Management Platform for Teams',
    siteDescription:
      'SafeTasks helps production teams manage projects, finance, scheduling, inventory, and collaboration in one production OS.',
    landingTitle: 'SafeTasks | Production OS for Film Teams and Studios',
    landingDescription:
      'Run projects, approvals, team workflows, and production finance in one role-based workspace for audiovisual teams.',
    pricingTitle: 'SafeTasks Pricing | Plans for Film Teams and Studios',
    pricingDescription:
      'Choose a SafeTasks plan based on your team size and usage. Start with trial access and upgrade as productions scale.',
    faqTitle: 'FAQ | SafeTasks — Billing, Refunds & Support',
    faqDescription:
      'Find answers about SafeTasks subscriptions, refund policy, data privacy, account management, and platform usage.',
    aboutTitle: 'About SafeTasks | Production Management for Film Teams',
    aboutDescription:
      'Learn about SafeTasks — the production management platform built for audiovisual teams. Our mission, values, and team.',
    openGraphLocale: 'en_US',
  },
  'pt-br': {
    siteTitle: 'SafeTasks | Plataforma de Gestao para Producao Audiovisual',
    siteDescription:
      'SafeTasks ajuda produtoras a gerenciar projetos, financeiro, cronograma, inventario e colaboracao em um unico sistema.',
    landingTitle: 'SafeTasks | Sistema de Producao para Equipes Audiovisuais',
    landingDescription:
      'Organize projetos, aprovacoes, fluxo da equipe e financeiro de producao em um workspace moderno e orientado por funcao.',
    pricingTitle: 'Planos SafeTasks | Escala para Equipes e Produtoras',
    pricingDescription:
      'Escolha o plano SafeTasks ideal para o tamanho da sua equipe e nivel de uso. Comece com trial e evolua conforme a producao cresce.',
    faqTitle: 'FAQ | SafeTasks — Cobrança, Reembolso e Suporte',
    faqDescription:
      'Encontre respostas sobre assinaturas, política de reembolso, privacidade de dados, gestão de conta e uso da plataforma SafeTasks.',
    aboutTitle: 'Sobre o SafeTasks | Gestão de Produção Audiovisual',
    aboutDescription:
      'Conheça o SafeTasks — a plataforma de gestão de produção para equipes audiovisuais. Nossa missão, valores e equipe.',
    openGraphLocale: 'pt_BR',
  },
}

function normalizePath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!configured) {
    return DEFAULT_SITE_URL
  }

  try {
    return new URL(configured).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function getSeoCopy(locale: Locale): LocaleSeoCopy {
  return SEO_COPY[locale] ?? SEO_COPY[defaultLocale]
}

export function getLocalizedPath(locale: Locale, path = ''): string {
  const normalized = normalizePath(path)
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`
}

export function getAbsoluteUrl(path: string): string {
  return new URL(normalizePath(path), getSiteUrl()).toString()
}

export function getAbsoluteLocaleUrl(locale: Locale, path = ''): string {
  return getAbsoluteUrl(getLocalizedPath(locale, path))
}

export function getLanguageAlternates(path = ''): Record<string, string> {
  const alternates: Record<string, string> = {}
  for (const locale of locales) {
    alternates[locale] = getAbsoluteLocaleUrl(locale, path)
  }
  alternates['x-default'] = getAbsoluteLocaleUrl(defaultLocale, path)
  return alternates
}

export function getLandingOpenGraphImagePath(locale: Locale): string {
  return STATIC_OG_IMAGES[locale]?.landing ?? STATIC_OG_IMAGES[defaultLocale].landing
}

export function getLandingTwitterImagePath(locale: Locale): string {
  return getLandingOpenGraphImagePath(locale)
}

export function getOpenGraphLogoPath(locale: Locale): string {
  return getLocalizedPath(locale, '/og/logo')
}

export function getPricingOpenGraphImagePath(locale: Locale): string {
  return STATIC_OG_IMAGES[locale]?.pricing ?? STATIC_OG_IMAGES[defaultLocale].pricing
}

export function getPricingTwitterImagePath(locale: Locale): string {
  return getPricingOpenGraphImagePath(locale)
}
