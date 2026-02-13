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
