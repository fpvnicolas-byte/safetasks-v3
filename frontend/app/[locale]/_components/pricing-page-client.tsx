'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Check, CreditCard, Sparkles, Stars } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { useAuth } from '@/contexts/AuthContext'

type PricingPlanKey = 'starter' | 'pro' | 'proAnnual' | 'enterprise'

interface PricingPlan {
  key: PricingPlanKey
  highlight?: boolean
  icon: typeof CreditCard
}

const BILLING_PLAN_KEY_MAP: Record<PricingPlanKey, string> = {
  starter: 'starter',
  pro: 'professional',
  proAnnual: 'professional_annual',
  enterprise: 'enterprise',
}

export default function PricingPage() {
  const t = useTranslations('pricing')
  const locale = useLocale()
  const basePath = `/${locale}`
  const { user } = useAuth()
  const isLoggedIn = Boolean(user)

  const plans: PricingPlan[] = [
    { key: 'starter', icon: CreditCard },
    { key: 'pro', icon: Sparkles, highlight: true },
    { key: 'proAnnual', icon: Stars },
    { key: 'enterprise', icon: CreditCard },
  ]

  const includes = t.raw('includes.items') as string[] | undefined
  const faqItems = t.raw('faq.items') as { q: string; a: string }[] | undefined

  const getFeatures = (key: PricingPlanKey) => {
    const raw = t.raw(`plans.${key}.features`)
    return Array.isArray(raw) ? (raw as string[]) : []
  }

  const getPlanCheckoutPath = (key: PricingPlanKey) => {
    if (!isLoggedIn) {
      return `${basePath}/auth/register`
    }

    const billingKey = BILLING_PLAN_KEY_MAP[key]
    return `${basePath}/settings/billing/plans?plan=${encodeURIComponent(billingKey)}`
  }

  return (
    <div
      className="min-h-screen bg-[#f2ece2] text-slate-900 [font-family:'Avenir_Next','Segoe_UI',ui-sans-serif,sans-serif]"
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-amber-400/20 blur-[140px]" />
        <div className="pointer-events-none absolute top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-400/20 blur-[140px]" />

        <div className="container mx-auto px-4 pb-20 pt-10">
          <PublicHeader />

          <section className="mt-14 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{t('eyebrow')}</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-5xl [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">{t('title')}</h1>
            <p className="mt-3 text-slate-600">{t('subtitle')}</p>
          </section>

          <section className="mt-14 grid gap-6 lg:grid-cols-4">
            {plans.map((plan, index) => {
              const planKey = plan.key
              const features = getFeatures(planKey)
              const buttonClass = plan.highlight
                ? 'bg-amber-300 text-slate-900 hover:bg-amber-200'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              return (
                <Card
                  key={planKey}
                  className={`relative border-slate-200/80 bg-[#fbf7f0] text-slate-900 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ${
                    plan.highlight ? 'ring-2 ring-amber-300/70' : ''
                  }`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  {plan.highlight && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200 shadow-lg">
                      {t('mostPopular')}
                    </div>
                  )}
                  <CardContent className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-full shadow-sm ${
                          planKey === 'proAnnual'
                            ? 'bg-amber-300 text-slate-900'
                            : 'bg-slate-900 text-amber-200'
                        }`}
                      >
                        <plan.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{t(`plans.${planKey}.name`)}</div>
                        <p className="text-sm text-slate-600">{t(`plans.${planKey}.description`)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-semibold text-slate-900">
                          {t(`plans.${planKey}.price`)}
                        </span>
                        <span className="text-sm text-slate-500">
                          /{t(`plans.${planKey}.period`)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                        {t(`plans.${planKey}.billingNote`)}
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-600">
                      {features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 text-slate-900" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className={`mt-auto ${buttonClass}`}
                      variant={plan.highlight ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href={getPlanCheckoutPath(planKey)}>{t(`plans.${planKey}.cta`)}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <Card className="border-slate-200/80 bg-white/85 text-slate-900">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-2xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">{t('includes.title')}</h2>
                <div className="space-y-3 text-sm text-slate-600">
                  {(Array.isArray(includes) ? includes : []).map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-slate-900" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">{t('note')}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/85 text-slate-900">
              <CardContent className="space-y-6 p-6">
                <h2 className="text-2xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">{t('faq.title')}</h2>
                <div className="space-y-5 text-sm text-slate-600">
                  {(Array.isArray(faqItems) ? faqItems : []).map((item) => (
                    <div key={item.q}>
                      <p className="font-semibold text-slate-900">{item.q}</p>
                      <p className="mt-1">{item.a}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-16">
            <Card className="border-slate-200/80 bg-slate-900 text-amber-100">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-8 md:flex-row md:items-center">
                <div>
                  <h2 className="text-3xl font-semibold [font-family:'Iowan_Old_Style','Palatino_Linotype','Times_New_Roman',serif]">{t('cta.title')}</h2>
                  <p className="mt-2 text-slate-300">{t('cta.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" asChild className="bg-amber-300 text-slate-900 hover:bg-amber-200">
                    <Link href={getPlanCheckoutPath('pro')}>{t('cta.primary')}</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="border-amber-200/40 text-amber-100 hover:bg-white/10">
                    <Link href={`${basePath}`}>{t('cta.secondary')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
