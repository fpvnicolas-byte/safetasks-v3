# FAQ & About Us Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create public FAQ (Brazilian-law compliant) and About Us pages with a shared public layout extracted from the landing page.

**Architecture:** Extract header/footer from landing page into reusable `PublicHeader`/`PublicFooter` components. Create a `(public)` route group with shared layout. Build FAQ page with accordion sections and About page with mission/team sections. All content internationalized (en + pt-br). SEO metadata for both pages.

**Tech Stack:** Next.js 15 App Router, next-intl, shadcn/ui (Accordion, Card, Button), Tailwind CSS 4, Radix UI

---

### Task 1: Install shadcn/ui Accordion component

**Files:**
- Create: `frontend/components/ui/accordion.tsx`

**Step 1: Install accordion**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npx shadcn@latest add accordion`

Expected: Creates `components/ui/accordion.tsx` and installs `@radix-ui/react-accordion` if not present.

**Step 2: Verify it was created**

Run: `ls /Users/nicolasbertoni/safetasks-v3/frontend/components/ui/accordion.tsx`

**Step 3: Commit**

```bash
git add frontend/components/ui/accordion.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn accordion component"
```

---

### Task 2: Add i18n translation keys for FAQ and About pages

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/pt-br.json`

**Step 1: Add English FAQ translations**

Add a `"faq"` key at root level of `frontend/messages/en.json` with this structure:

```json
"faq": {
  "meta": {
    "title": "FAQ | SafeTasks",
    "description": "Find answers to frequently asked questions about SafeTasks, including billing, refunds, data privacy, and platform usage."
  },
  "hero": {
    "eyebrow": "SUPPORT",
    "title": "Frequently Asked Questions",
    "subtitle": "Find answers about billing, refunds, privacy, and using SafeTasks."
  },
  "categories": {
    "subscriptions": {
      "title": "Subscriptions & Plans",
      "items": [
        {
          "q": "What plans does SafeTasks offer?",
          "a": "SafeTasks offers three plans: Starter for small teams, Professional for growing production companies, and Enterprise for large studios. All plans include core project management features, with higher tiers unlocking advanced financial tools, more storage, and priority support."
        },
        {
          "q": "How does the free trial work?",
          "a": "Every new account starts with a 14-day free trial of the Professional plan. No credit card is required. At the end of the trial, you can choose a paid plan or your account will be downgraded to limited access."
        },
        {
          "q": "How do I upgrade or downgrade my plan?",
          "a": "You can change your plan at any time from Settings > Billing. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing cycle."
        },
        {
          "q": "What payment methods are accepted?",
          "a": "We accept all major credit cards (Visa, Mastercard, American Express) and Pix via our payment processor Stripe. All transactions are processed securely."
        }
      ]
    },
    "refunds": {
      "title": "Refund Policy",
      "items": [
        {
          "q": "What is your refund policy?",
          "a": "In accordance with the Brazilian Consumer Defense Code (CDC, Art. 49), you have the right to cancel and receive a full refund within 7 days of your purchase, for any reason. This right of withdrawal (direito de arrependimento) applies to all subscription plans contracted online."
        },
        {
          "q": "How do I request a refund?",
          "a": "To request a refund within the 7-day withdrawal period, go to Settings > Billing > Cancel Subscription or send an email to support@safetasks.com. Refund requests within the 7-day period are processed automatically without the need for justification."
        },
        {
          "q": "How long does a refund take to process?",
          "a": "Refunds are processed within 5-10 business days after the request is confirmed. The amount will be returned to the original payment method. For credit card payments, the refund may take an additional billing cycle to appear on your statement."
        },
        {
          "q": "Can I get a refund after the 7-day withdrawal period?",
          "a": "After the 7-day withdrawal period, cancellations take effect at the end of the current billing cycle. You will retain access to your plan features until that date. Prorated refunds may be issued on a case-by-case basis for annual plans — contact support@safetasks.com."
        }
      ]
    },
    "cancellation": {
      "title": "Cancellation",
      "items": [
        {
          "q": "How do I cancel my subscription?",
          "a": "Go to Settings > Billing and click 'Cancel Subscription'. You can also contact support@safetasks.com. Cancellation takes effect at the end of your current billing period, and you retain access until then."
        },
        {
          "q": "What happens to my data after cancellation?",
          "a": "After cancellation, your data is retained for 90 days in case you decide to reactivate your account. After 90 days, your data will be permanently deleted in accordance with our data retention policy. You can request immediate deletion by contacting support."
        },
        {
          "q": "Can I reactivate my account after cancellation?",
          "a": "Yes. Within 90 days of cancellation, you can reactivate your account and all your data will be restored. Simply log in and choose a new plan from the billing page."
        }
      ]
    },
    "privacy": {
      "title": "Privacy & Data Protection",
      "items": [
        {
          "q": "What data does SafeTasks collect?",
          "a": "We collect the data necessary to provide our services: account information (name, email), project data you create, usage analytics, and payment information processed securely through Stripe. We do not sell your data to third parties."
        },
        {
          "q": "How does SafeTasks comply with LGPD?",
          "a": "SafeTasks fully complies with the Brazilian General Data Protection Law (Lei Geral de Proteção de Dados - LGPD). We process data based on legitimate interest and contractual necessity. You can exercise your LGPD rights at any time."
        },
        {
          "q": "What are my data rights under LGPD?",
          "a": "Under LGPD, you have the right to: access your personal data, correct inaccurate data, request deletion of your data, obtain data portability, revoke consent, and receive information about which entities your data has been shared with. Exercise these rights via Settings > Account or by emailing privacy@safetasks.com."
        },
        {
          "q": "Where is my data stored?",
          "a": "Your data is stored on secure servers provided by Supabase and Vercel, with data centers primarily located in the United States. All data transfers comply with applicable data protection regulations including LGPD requirements for international transfers."
        }
      ]
    },
    "account": {
      "title": "Account & Security",
      "items": [
        {
          "q": "How do I create an account?",
          "a": "Click 'Start Free Trial' on our homepage or go to the registration page. You can sign up with your email address. Verify your email to activate your account."
        },
        {
          "q": "How do I delete my account?",
          "a": "Go to Settings > Account > Delete Account. This will schedule your account and all associated data for permanent deletion after a 30-day grace period, as required by LGPD. Contact support if you need immediate deletion."
        },
        {
          "q": "How do I reset my password?",
          "a": "Click 'Forgot Password' on the login page and enter your email. You will receive a password reset link valid for 24 hours."
        },
        {
          "q": "How do I manage team members?",
          "a": "Account owners and admins can invite team members from Settings > Team. Each member is assigned a role (Producer, Finance, Freelancer) that determines their access level within projects."
        }
      ]
    },
    "platform": {
      "title": "Platform Usage",
      "items": [
        {
          "q": "Which browsers are supported?",
          "a": "SafeTasks works on all modern browsers: Chrome, Firefox, Safari, and Edge (latest two versions). We recommend Chrome for the best experience."
        },
        {
          "q": "Can I use SafeTasks on mobile?",
          "a": "Yes. SafeTasks is fully responsive and works on mobile browsers. While we don't have a native app yet, the mobile web experience is optimized for on-set and on-the-go usage."
        },
        {
          "q": "Can I export my data?",
          "a": "Yes. You can export project data, financial reports, and contacts from their respective pages. Exports are available in CSV and PDF formats depending on the data type."
        },
        {
          "q": "What are the storage limits?",
          "a": "Storage limits vary by plan: Starter includes 5GB, Professional includes 50GB, and Enterprise includes unlimited storage. Storage is used for file uploads, documents, and media assets managed through the platform."
        }
      ]
    }
  },
  "contact": {
    "title": "Still have questions?",
    "description": "Our support team is here to help.",
    "cta": "Contact Support",
    "email": "support@safetasks.com"
  }
}
```

**Step 2: Add English About translations**

Add an `"about"` key at root level of `frontend/messages/en.json`:

```json
"about": {
  "meta": {
    "title": "About Us | SafeTasks",
    "description": "Learn about SafeTasks — the production management platform built for audiovisual teams. Our mission, story, and team."
  },
  "hero": {
    "eyebrow": "ABOUT US",
    "title": "Built for audiovisual production teams",
    "subtitle": "SafeTasks is a production management platform designed to simplify the chaos of film, TV, and content production."
  },
  "story": {
    "title": "Our Story",
    "paragraphs": [
      "Managing audiovisual productions has always been complex — scattered spreadsheets, disorganized budgets, endless email chains, and no single source of truth for the entire team.",
      "SafeTasks was born from the firsthand experience of producers who lived this chaos. We built the platform we wished existed: a unified workspace where every role — from executive producers to freelancers — can collaborate, track finances, manage schedules, and keep productions running smoothly.",
      "Today, SafeTasks helps production teams across Brazil and beyond organize their work, control costs, and deliver projects on time."
    ]
  },
  "values": {
    "title": "Our Values",
    "items": [
      {
        "title": "Simplicity",
        "description": "Production is complex enough. Our tools should make it simpler, not add more layers."
      },
      {
        "title": "Security",
        "description": "Your production data and financials deserve enterprise-grade protection. We take security seriously."
      },
      {
        "title": "Collaboration",
        "description": "Great productions are a team effort. Our platform is built around roles, permissions, and shared workflows."
      },
      {
        "title": "Innovation",
        "description": "We continuously evolve the platform with AI-powered insights and modern tools to keep you ahead."
      }
    ]
  },
  "team": {
    "title": "Our Team",
    "subtitle": "The people behind SafeTasks.",
    "members": [
      {
        "name": "Team Member",
        "role": "Founder & CEO",
        "bio": "Audiovisual producer turned tech entrepreneur. Built SafeTasks to solve the problems he faced daily on set."
      },
      {
        "name": "Team Member",
        "role": "CTO",
        "bio": "Full-stack engineer passionate about building tools that empower creative teams."
      },
      {
        "name": "Team Member",
        "role": "Head of Product",
        "bio": "Product designer focused on creating intuitive experiences for complex workflows."
      }
    ]
  },
  "contact": {
    "title": "Get in Touch",
    "description": "Have questions, partnership ideas, or feedback? We'd love to hear from you.",
    "cta": "Contact Us",
    "email": "contact@safetasks.com"
  }
}
```

**Step 3: Add nav translation keys**

Add to the `"landing"` > `"nav"` section in `en.json`:

```json
"faq": "FAQ",
"about": "About"
```

And add to `"landing"` > `"footer"` area (or create a new `"publicNav"` key):

```json
"publicFooter": {
  "copyright": "© 2026 SafeTasks. All rights reserved.",
  "links": {
    "faq": "FAQ",
    "about": "About Us",
    "pricing": "Pricing"
  }
}
```

**Step 4: Add Brazilian Portuguese translations**

Add the equivalent `"faq"`, `"about"`, nav keys, and `"publicFooter"` to `frontend/messages/pt-br.json` with properly translated content. The FAQ content must be legally accurate in Portuguese (CDC terminology: "direito de arrependimento", "prazo de 7 dias", LGPD terms: "titular dos dados", "tratamento de dados pessoais", etc.).

Key translations for the FAQ refund section in pt-br:
- "Refund Policy" → "Política de Reembolso"
- "right of withdrawal" → "direito de arrependimento"
- "Brazilian Consumer Defense Code" → "Código de Defesa do Consumidor"
- "cancellation" → "cancelamento"

Key translations for privacy section in pt-br:
- "Brazilian General Data Protection Law" → "Lei Geral de Proteção de Dados"
- "data rights" → "direitos do titular"
- "data portability" → "portabilidade dos dados"
- "consent" → "consentimento"

**Step 5: Commit**

```bash
git add frontend/messages/en.json frontend/messages/pt-br.json
git commit -m "feat: add FAQ and About Us i18n translations (en + pt-br)"
```

---

### Task 3: Extract PublicHeader component

**Files:**
- Create: `frontend/components/public/PublicHeader.tsx`
- Modify: `frontend/app/[locale]/_components/landing-page-client.tsx`

**Step 1: Create PublicHeader component**

Create `frontend/components/public/PublicHeader.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { locales, type Locale } from '@/i18n/config'

interface PublicHeaderProps {
  /** Extra nav items to show before the standard links (e.g., landing page section anchors) */
  extraNav?: React.ReactNode
}

export function PublicHeader({ extraNav }: PublicHeaderProps) {
  const t = useTranslations('landing')
  const locale = useLocale()
  const basePath = `/${locale}`

  return (
    <header className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
      <div className="flex items-center gap-3">
        <Link href={basePath} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-300 shadow-lg">
            <Clapperboard className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">SafeTasks</div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Production OS</div>
          </div>
        </Link>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 md:justify-end">
        {extraNav}
        <Link href={`${basePath}/pricing`} className="hover:text-slate-900">{t('nav.pricing')}</Link>
        <Link href={`${basePath}/faq`} className="hover:text-slate-900">{t('nav.faq')}</Link>
        <Link href={`${basePath}/about`} className="hover:text-slate-900">{t('nav.about')}</Link>
        <Link href={`${basePath}/auth/login`} className="hover:text-slate-900">{t('nav.signIn')}</Link>
        <Button asChild size="sm" className="bg-slate-900 text-amber-200 hover:bg-slate-800">
          <Link href={`${basePath}/auth/register`}>{t('nav.getStarted')}</Link>
        </Button>
      </nav>
    </header>
  )
}
```

**Step 2: Update landing page to use PublicHeader**

In `frontend/app/[locale]/_components/landing-page-client.tsx`, replace the inline `<header>` block (lines 166-192) with:

```tsx
import { PublicHeader } from '@/components/public/PublicHeader'

// In the component, replace the <header>...</header> with:
<PublicHeader
  extraNav={
    <>
      <a href="#modules" onClick={handleNavClick('modules')} className="hover:text-slate-900">
        {t('nav.modules')}
      </a>
      <a href="#workflow" onClick={handleNavClick('workflow')} className="hover:text-slate-900">
        {t('nav.workflow')}
      </a>
      <a href="#access" onClick={handleNavClick('access')} className="hover:text-slate-900">
        {t('nav.features')}
      </a>
    </>
  }
/>
```

**Step 3: Verify landing page still renders**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/components/public/PublicHeader.tsx frontend/app/[locale]/_components/landing-page-client.tsx
git commit -m "feat: extract PublicHeader component from landing page"
```

---

### Task 4: Extract PublicFooter component

**Files:**
- Create: `frontend/components/public/PublicFooter.tsx`
- Modify: `frontend/app/[locale]/_components/landing-page-client.tsx`

**Step 1: Create PublicFooter component**

Create `frontend/components/public/PublicFooter.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locales, localeNames, type Locale } from '@/i18n/config'

export function PublicFooter() {
  const t = useTranslations('publicFooter')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const basePath = `/${locale}`
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildLocalePath = (nextLocale: Locale) => {
    const segments = pathname.split('/')
    if (segments.length > 1) {
      segments[1] = nextLocale
      return segments.join('/')
    }
    return `/${nextLocale}`
  }

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) return
    const nextPath = buildLocalePath(nextLocale as Locale)
    const queryString = searchParams.toString()
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    router.push(`${nextPath}${queryString ? `?${queryString}` : ''}${hash}`)
  }

  return (
    <footer className="border-t border-slate-200/60 py-8">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 text-center text-sm text-slate-500 md:flex-row md:text-left">
        <div>{t('copyright')}</div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href={`${basePath}/pricing`} className="hover:text-slate-900">{t('links.pricing')}</Link>
          <Link href={`${basePath}/faq`} className="hover:text-slate-900">{t('links.faq')}</Link>
          <Link href={`${basePath}/about`} className="hover:text-slate-900">{t('links.about')}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {tCommon('language')}
          </span>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger size="sm" className="w-[180px] border-slate-300 bg-white/80 text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {locales.map((option) => (
                <SelectItem key={option} value={option}>
                  {localeNames[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </footer>
  )
}
```

**Step 2: Update landing page to use PublicFooter**

In `frontend/app/[locale]/_components/landing-page-client.tsx`, replace the `<footer>` block (lines 436-457) with:

```tsx
import { PublicFooter } from '@/components/public/PublicFooter'

// Replace <footer>...</footer> with:
<PublicFooter />
```

Also remove the now-unused imports and locale-change logic from the landing page (the `buildLocalePath`, `handleLocaleChange` functions, and related state that are now only used in the footer — keep `handleNavClick` which is still used for section scrolling).

**Step 3: Verify build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/components/public/PublicFooter.tsx frontend/app/[locale]/_components/landing-page-client.tsx
git commit -m "feat: extract PublicFooter component from landing page"
```

---

### Task 5: Create public route group layout

**Files:**
- Create: `frontend/app/[locale]/(public)/layout.tsx`
- Move: `frontend/app/[locale]/page.tsx` → `frontend/app/[locale]/(public)/page.tsx`
- Move: `frontend/app/[locale]/pricing/page.tsx` → `frontend/app/[locale]/(public)/pricing/page.tsx`
- Keep: `frontend/app/[locale]/_components/` stays where it is (shared across route groups)

**Important note:** Route groups in Next.js (parenthesized folders) do not affect the URL path. Moving pages into `(public)/` keeps URLs identical.

**Step 1: Create the layout**

Create `frontend/app/[locale]/(public)/layout.tsx`:

```tsx
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

Note: We keep this minimal. The header/footer are rendered by each page's client component (landing, pricing already have their own wrappers). The layout exists to group public pages and could later hold shared structure.

**Step 2: Move landing page**

```bash
mkdir -p /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/\(public\)
mv /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/page.tsx /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/\(public\)/page.tsx
```

Update the import path in the moved file — the `_components` import path changes from `'./_components/landing-page-client'` to `'../_components/landing-page-client'` (one directory up).

**Step 3: Move pricing page**

```bash
mkdir -p /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/\(public\)/pricing
mv /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/pricing/page.tsx /Users/nicolasbertoni/safetasks-v3/frontend/app/\[locale\]/\(public\)/pricing/page.tsx
```

Update the import path in pricing: `'../_components/pricing-page-client'` → `'../../_components/pricing-page-client'`

**Step 4: Verify build and that both pages load at same URLs**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -30`

Verify routes `/en`, `/en/pricing`, `/pt-br`, `/pt-br/pricing` still appear in the build output.

**Step 5: Commit**

```bash
git add -A frontend/app/[locale]/\(public\) frontend/app/[locale]/page.tsx frontend/app/[locale]/pricing
git commit -m "feat: create (public) route group and move landing/pricing pages"
```

---

### Task 6: Create FAQ page

**Files:**
- Create: `frontend/app/[locale]/(public)/faq/page.tsx`
- Create: `frontend/app/[locale]/_components/faq-page-client.tsx`

**Step 1: Create FAQ server page with metadata**

Create `frontend/app/[locale]/(public)/faq/page.tsx`:

```tsx
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
```

**Step 2: Create FAQ client component**

Create `frontend/app/[locale]/_components/faq-page-client.tsx`:

```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { HelpCircle } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

const CATEGORY_KEYS = [
  'subscriptions',
  'refunds',
  'cancellation',
  'privacy',
  'account',
  'platform',
] as const

export default function FaqPageClient() {
  const t = useTranslations('faq')
  const locale = useLocale()
  const basePath = `/${locale}`

  return (
    <div className="min-h-screen bg-[#f2ece2] text-slate-900 [font-family:'Avenir_Next','Segoe_UI',ui-sans-serif,sans-serif]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-amber-400/20 blur-[140px]" />
        <div className="pointer-events-none absolute top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-400/20 blur-[140px]" />

        <div className="container mx-auto px-4 pb-20 pt-10">
          <PublicHeader />

          <section className="mt-14 max-w-3xl mx-auto">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('hero.eyebrow')}</p>
              <h1 className="mt-3 text-4xl font-semibold md:text-5xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('hero.title')}
              </h1>
              <p className="mt-3 text-slate-600">{t('hero.subtitle')}</p>
            </div>

            <div className="mt-12 space-y-8">
              {CATEGORY_KEYS.map((categoryKey) => {
                const items = t.raw(`categories.${categoryKey}.items`) as { q: string; a: string }[]
                return (
                  <div key={categoryKey}>
                    <h2 className="mb-4 text-xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                      {t(`categories.${categoryKey}.title`)}
                    </h2>
                    <Card className="border-slate-200/80 bg-white/85 text-slate-900">
                      <CardContent className="p-0">
                        <Accordion type="single" collapsible className="w-full">
                          {items.map((item, index) => (
                            <AccordionItem key={index} value={`${categoryKey}-${index}`} className="px-6">
                              <AccordionTrigger className="text-left font-semibold text-slate-900">
                                {item.q}
                              </AccordionTrigger>
                              <AccordionContent className="text-sm text-slate-600 leading-relaxed">
                                {item.a}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>

            <Card className="mt-12 border-slate-200/80 bg-slate-900 text-amber-100">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <HelpCircle className="h-8 w-8 text-amber-300" />
                <h2 className="text-2xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                  {t('contact.title')}
                </h2>
                <p className="text-slate-300">{t('contact.description')}</p>
                <Button asChild className="bg-amber-300 text-slate-900 hover:bg-amber-200">
                  <a href={`mailto:${t('contact.email')}`}>{t('contact.cta')}</a>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
```

**Step 3: Verify build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/app/[locale]/\(public\)/faq frontend/app/[locale]/_components/faq-page-client.tsx
git commit -m "feat: add FAQ page with accordion categories and Brazilian legal compliance"
```

---

### Task 7: Create About Us page

**Files:**
- Create: `frontend/app/[locale]/(public)/about/page.tsx`
- Create: `frontend/app/[locale]/_components/about-page-client.tsx`

**Step 1: Create About server page with metadata**

Create `frontend/app/[locale]/(public)/about/page.tsx`:

```tsx
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
```

**Step 2: Create About client component**

Create `frontend/app/[locale]/_components/about-page-client.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Shield, Users, Lightbulb, Sparkles, Mail } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

const VALUE_ICONS = [Lightbulb, Shield, Users, Sparkles]

export default function AboutPageClient() {
  const t = useTranslations('about')
  const locale = useLocale()
  const basePath = `/${locale}`

  const paragraphs = t.raw('story.paragraphs') as string[]
  const values = t.raw('values.items') as { title: string; description: string }[]
  const members = t.raw('team.members') as { name: string; role: string; bio: string }[]

  return (
    <div className="min-h-screen bg-[#f2ece2] text-slate-900 [font-family:'Avenir_Next','Segoe_UI',ui-sans-serif,sans-serif]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-amber-400/20 blur-[140px]" />
        <div className="pointer-events-none absolute top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-400/20 blur-[140px]" />

        <div className="container mx-auto px-4 pb-20 pt-10">
          <PublicHeader />

          {/* Hero */}
          <section className="mt-14 max-w-3xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('hero.eyebrow')}</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-5xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
              {t('hero.title')}
            </h1>
            <p className="mt-3 text-lg text-slate-600">{t('hero.subtitle')}</p>
          </section>

          {/* Our Story */}
          <section className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-3xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
              {t('story.title')}
            </h2>
            <div className="mt-6 space-y-4 text-slate-600 leading-relaxed">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          {/* Our Values */}
          <section className="mt-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('values.title')}
              </h2>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              {values.map((value, index) => {
                const Icon = VALUE_ICONS[index % VALUE_ICONS.length]
                return (
                  <Card
                    key={value.title}
                    className="border-slate-200/80 bg-[#fbf7f0] text-slate-900 shadow-md animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-amber-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold">{value.title}</h3>
                      <p className="text-sm text-slate-600">{value.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          {/* Team */}
          <section className="mt-20 max-w-4xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('team.title')}
              </h2>
              <p className="mt-2 text-slate-600">{t('team.subtitle')}</p>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {members.map((member, index) => (
                <Card
                  key={index}
                  className="border-slate-200/80 bg-white/85 text-slate-900 shadow-md animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-2xl font-semibold">
                      {member.name.charAt(0)}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
                    <p className="text-sm text-amber-700 font-medium">{member.role}</p>
                    <p className="mt-2 text-sm text-slate-600">{member.bio}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Contact CTA */}
          <section className="mt-20 max-w-3xl mx-auto">
            <Card className="border-slate-200/80 bg-slate-900 text-amber-100">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <Mail className="h-8 w-8 text-amber-300" />
                <h2 className="text-2xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                  {t('contact.title')}
                </h2>
                <p className="text-slate-300">{t('contact.description')}</p>
                <Button asChild className="bg-amber-300 text-slate-900 hover:bg-amber-200">
                  <a href={`mailto:${t('contact.email')}`}>{t('contact.cta')}</a>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
```

**Step 3: Verify build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/app/[locale]/\(public\)/about frontend/app/[locale]/_components/about-page-client.tsx
git commit -m "feat: add About Us page with mission, values, and team sections"
```

---

### Task 8: Update SEO configuration

**Files:**
- Modify: `frontend/lib/seo.ts`
- Modify: `frontend/app/sitemap.ts`

**Step 1: Update `lib/seo.ts`**

Add `/faq` and `/about` to `PUBLIC_INDEXABLE_PATHS`:

```typescript
export const PUBLIC_INDEXABLE_PATHS = ['', '/pricing', '/faq', '/about'] as const
```

Add `faqTitle`, `faqDescription`, `aboutTitle`, `aboutDescription` fields to the `LocaleSeoCopy` interface and both locale entries in `SEO_COPY`:

```typescript
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
    // ... existing fields ...
    faqTitle: 'FAQ | SafeTasks — Billing, Refunds & Support',
    faqDescription: 'Find answers about SafeTasks subscriptions, refund policy, data privacy, account management, and platform usage.',
    aboutTitle: 'About SafeTasks | Production Management for Film Teams',
    aboutDescription: 'Learn about SafeTasks — the production management platform built for audiovisual teams. Our mission, values, and team.',
    // ...
  },
  'pt-br': {
    // ... existing fields ...
    faqTitle: 'FAQ | SafeTasks — Cobrança, Reembolso e Suporte',
    faqDescription: 'Encontre respostas sobre assinaturas, política de reembolso, privacidade de dados, gestão de conta e uso da plataforma SafeTasks.',
    aboutTitle: 'Sobre o SafeTasks | Gestão de Produção Audiovisual',
    aboutDescription: 'Conheça o SafeTasks — a plataforma de gestão de produção para equipes audiovisuais. Nossa missão, valores e equipe.',
    // ...
  },
}
```

**Step 2: Update `app/sitemap.ts`**

Add config for the new paths in `PAGE_CONFIG`:

```typescript
'/faq': {
  priority: 0.7,
  changeFrequency: 'monthly',
},
'/about': {
  priority: 0.6,
  changeFrequency: 'monthly',
},
```

**Step 3: Verify build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/lib/seo.ts frontend/app/sitemap.ts
git commit -m "feat: add FAQ and About pages to SEO config and sitemap"
```

---

### Task 9: Update pricing page to use shared header/footer

**Files:**
- Modify: `frontend/app/[locale]/_components/pricing-page-client.tsx`

**Step 1: Update pricing page**

The pricing page currently has a minimal header (just title + back button) and no footer. Update it to use `PublicHeader` and `PublicFooter` for consistent navigation:

Replace the inline `<header>` in pricing-page-client.tsx with `<PublicHeader />`, and add `<PublicFooter />` before the closing `</div>`.

Keep the pricing page's hero section (eyebrow, title, subtitle) but move it below the shared header as a hero section rather than inside the header.

**Step 2: Verify build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add frontend/app/[locale]/_components/pricing-page-client.tsx
git commit -m "feat: update pricing page to use shared PublicHeader and PublicFooter"
```

---

### Task 10: Final verification

**Step 1: Full build**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run build`

Verify all routes build successfully, no TypeScript errors.

**Step 2: Check translation consistency**

Run: `cd /Users/nicolasbertoni/safetasks-v3/frontend && npm run check-translations` (if this script exists)

**Step 3: Manual review checklist**

- [ ] `/en/faq` renders with all 6 FAQ categories and accordion
- [ ] `/pt-br/faq` renders with Brazilian Portuguese content
- [ ] `/en/about` renders with all sections
- [ ] `/pt-br/about` renders with Portuguese content
- [ ] Landing page header now shows FAQ and About links
- [ ] Footer shows on all public pages with legal links
- [ ] Language switcher works on FAQ and About pages
- [ ] SEO metadata is correct (check page source)
- [ ] CDC Art. 49 refund policy is clearly stated
- [ ] LGPD data rights are properly documented
