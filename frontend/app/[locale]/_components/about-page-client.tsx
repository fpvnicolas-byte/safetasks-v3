'use client'

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
