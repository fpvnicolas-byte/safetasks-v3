'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowUpRight,
  Briefcase,
  Boxes,
  CalendarDays,
  Clapperboard,
  Cloud,
  CreditCard,
  Crown,
  HardDrive,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { PublicHeader } from '@/components/public/PublicHeader'

export default function LandingPage() {
  const t = useTranslations('landing')
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

  const handleNavClick = (sectionId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById(sectionId)
    if (!target) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    window.history.pushState(null, '', `#${sectionId}`)
  }

  const badges = [
    t('badges.roles'),
    t('badges.billing'),
    t('badges.drive'),
    t('badges.ai'),
  ]

  const modules = [
    {
      icon: Clapperboard,
      title: t('modules.production.title'),
      description: t('modules.production.description'),
    },
    {
      icon: CalendarDays,
      title: t('modules.scheduling.title'),
      description: t('modules.scheduling.description'),
    },
    {
      icon: CreditCard,
      title: t('modules.financials.title'),
      description: t('modules.financials.description'),
    },
    {
      icon: Boxes,
      title: t('modules.inventory.title'),
      description: t('modules.inventory.description'),
    },
    {
      icon: HardDrive,
      title: t('modules.files.title'),
      description: t('modules.files.description'),
    },
    {
      icon: Sparkles,
      title: t('modules.ai.title'),
      description: t('modules.ai.description'),
    },
  ]

  const workflow = [
    {
      title: t('workflow.step1.title'),
      description: t('workflow.step1.description'),
    },
    {
      title: t('workflow.step2.title'),
      description: t('workflow.step2.description'),
    },
    {
      title: t('workflow.step3.title'),
      description: t('workflow.step3.description'),
    },
  ]

  const access = [
    {
      icon: Crown,
      title: t('access.owner.title'),
      description: t('access.owner.description'),
    },
    {
      icon: Clapperboard,
      title: t('access.producer.title'),
      description: t('access.producer.description'),
    },
    {
      icon: CreditCard,
      title: t('access.finance.title'),
      description: t('access.finance.description'),
    },
    {
      icon: Briefcase,
      title: t('access.freelancer.title'),
      description: t('access.freelancer.description'),
    },
  ]

  const integrations = [
    {
      icon: Cloud,
      title: t('integrations.drive.title'),
      description: t('integrations.drive.description'),
    },
    {
      icon: CreditCard,
      title: t('integrations.stripe.title'),
      description: t('integrations.stripe.description'),
    },
    {
      icon: ShieldCheck,
      title: t('integrations.automation.title'),
      description: t('integrations.automation.description'),
    },
  ]

  return (
    <div
      className="min-h-screen bg-[#f2ece2] text-slate-900 [font-family:'Avenir_Next','Segoe_UI',ui-sans-serif,sans-serif]"
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-amber-400/20 blur-[140px]" />
        <div className="pointer-events-none absolute top-40 right-[-10%] h-[380px] w-[380px] rounded-full bg-emerald-400/20 blur-[140px]" />

        <div className="container mx-auto px-4 pb-24 pt-10">
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

          <section className="relative mt-10 overflow-hidden rounded-[36px] bg-[#0f1115] text-slate-50 shadow-2xl">
            <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-emerald-400/25 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-32 right-[-10%] h-72 w-72 rounded-full bg-amber-400/25 blur-[120px]" />
            <div className="grid gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
              <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-6 duration-700">
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{t('hero.eyebrow')}</p>
                  <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                    {t('hero.title')}
                  </h1>
                  <p className="mt-4 text-lg text-slate-300 md:text-xl">
                    {t('hero.subtitle')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Button
                    size="lg"
                    asChild
                    className="bg-amber-300 text-slate-900 hover:bg-amber-200"
                  >
                    <Link href={`${basePath}/auth/register`}>{t('hero.primaryCta')}</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-white/30 text-white hover:bg-white/10"
                  >
                    <Link href={`${basePath}/pricing`}>{t('hero.secondaryCta')}</Link>
                  </Button>
                </div>
                <p className="text-sm text-slate-400">{t('hero.note')}</p>
              </div>

              <div className="relative animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-150">
                <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/80 p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur md:min-h-[460px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_0%,rgba(56,189,248,0.12),transparent_60%),radial-gradient(55%_70%_at_100%_0%,rgba(251,191,36,0.14),transparent_55%)]" />
                  <div className="relative">
                    <div className="flex items-start justify-between border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                        </div>
                        <div>
                          <p className="text-[0.6rem] font-mono uppercase tracking-[0.35em] text-slate-400">
                            {t('console.label')}
                          </p>
                          <h3 className="text-xl font-semibold text-slate-100">{t('console.title')}</h3>
                        </div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-amber-200">
                        <ArrowUpRight className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-7 grid gap-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                        <p className="text-[0.65rem] font-mono uppercase tracking-[0.3em] text-slate-400">
                          {t('console.cards.active.label')}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-100">{t('console.cards.active.title')}</p>
                        <p className="text-sm text-slate-300">{t('console.cards.active.detail')}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                        <p className="text-[0.65rem] font-mono uppercase tracking-[0.3em] text-slate-400">
                          {t('console.cards.approvals.label')}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-100">{t('console.cards.approvals.title')}</p>
                        <p className="text-sm text-slate-300">{t('console.cards.approvals.detail')}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                        <p className="text-[0.65rem] font-mono uppercase tracking-[0.3em] text-slate-400">
                          {t('console.cards.storage.label')}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-100">{t('console.cards.storage.title')}</p>
                        <p className="text-sm text-slate-300">{t('console.cards.storage.detail')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="modules" className="mt-24 space-y-10">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('nav.modules')}</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('sections.modules.title')}
              </h2>
              <p className="mt-3 text-slate-600">{t('sections.modules.subtitle')}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module, index) => (
                <Card
                  key={module.title}
                  className="border-slate-200/80 bg-[#fbf7f0] text-slate-900 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-200">
                      <module.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{module.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">{module.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section
            id="workflow"
            className="mt-24 scroll-mt-24 grid gap-10 pb-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-20"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('nav.workflow')}</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('sections.workflow.title')}
              </h2>
              <p className="mt-3 text-slate-600">{t('sections.workflow.subtitle')}</p>
            </div>
            <div className="space-y-4 pt-22 lg:pt-26">
              {workflow.map((step, index) => (
                <Card
                  key={step.title}
                  className="border-slate-200/80 bg-white/80 text-slate-900 shadow-md"
                >
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-amber-200">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section id="access" className="mt-24 scroll-mt-24 space-y-10">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('nav.features')}</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('sections.access.title')}
              </h2>
              <p className="mt-3 text-slate-600">{t('sections.access.subtitle')}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {access.map((role, index) => (
                <Card
                  key={role.title}
                  className="border-slate-200/80 bg-[#fbf7f0] text-slate-900 shadow-md animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <CardContent className="space-y-3 p-5">
                    <role.icon className="h-5 w-5 text-slate-900" />
                    <h3 className="text-lg font-semibold">{role.title}</h3>
                    <p className="text-sm text-slate-600">{role.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-24 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('sections.integrations.title')}</p>
              <h2 className="text-3xl font-semibold md:text-4xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">
                {t('sections.integrations.title')}
              </h2>
              <p className="text-slate-600">{t('sections.integrations.subtitle')}</p>
              <div className="grid gap-4">
                {integrations.map((integration) => (
                  <div key={integration.title} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-amber-200">
                      <integration.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{integration.title}</div>
                      <p className="text-sm text-slate-600">{integration.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="border-slate-200/80 bg-white/85 text-slate-900 shadow-lg">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  {t('sections.testimonials.title')}
                </div>
                <div className="space-y-5">
                  <div>
                    <p className="text-lg font-semibold">&ldquo;{t('testimonials.one.quote')}&rdquo;</p>
                    <p className="text-sm text-slate-600">{t('testimonials.one.name')} · {t('testimonials.one.role')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">&ldquo;{t('testimonials.two.quote')}&rdquo;</p>
                    <p className="text-sm text-slate-600">{t('testimonials.two.name')} · {t('testimonials.two.role')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-24">
            <Card className="border-slate-200/80 bg-slate-900 text-amber-100">
              <CardContent className="flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">{t('sections.cta.title')}</h2>
                  <p className="mt-2 text-slate-300">{t('sections.cta.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" asChild className="bg-amber-300 text-slate-900 hover:bg-amber-200">
                    <Link href={`${basePath}/auth/register`}>{t('cta.primary')}</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="border-amber-200/40 text-amber-100 hover:bg-white/10">
                    <Link href={`${basePath}/pricing`}>{t('cta.secondary')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <footer className="border-t border-slate-200/60 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-center text-sm text-slate-500 md:flex-row md:text-left">
          <div>{t('footer')}</div>
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
    </div>
  )
}
