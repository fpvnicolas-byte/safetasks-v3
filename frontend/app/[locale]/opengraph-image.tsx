import { ImageResponse } from 'next/og'

import { getValidLocale } from '@/i18n/config'
import { getSeoCopy } from '@/lib/seo'

export const runtime = 'edge'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

interface ImageProps {
  params: Promise<{ locale: string }>
}

const BADGES = {
  en: ['Projects', 'Finance', 'Scheduling', 'AI'],
  'pt-br': ['Projetos', 'Financeiro', 'Agenda', 'IA'],
} as const

export default async function OpenGraphImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)
  const headline =
    locale === 'pt-br'
      ? 'Sistema de Producao para Equipes Audiovisuais'
      : 'Production OS for Film Teams'
  const ctaLabel = locale === 'pt-br' ? 'Criar conta gratis' : 'Create free account'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'radial-gradient(circle at 85% 20%, rgba(251,191,36,0.28), transparent 38%), radial-gradient(circle at 8% 88%, rgba(16,185,129,0.2), transparent 35%), #0f172a',
          color: '#f8fafc',
          padding: '52px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f59e0b',
                color: '#111827',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              S
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>SafeTasks</span>
              <span style={{ fontSize: 18, color: '#cbd5e1' }}>Production OS</span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.45)',
            color: '#e2e8f0',
            padding: '8px 16px',
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {locale.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 66,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            {headline}
          </div>
          <div style={{
            fontSize: 30,
            lineHeight: 1.3,
            color: '#cbd5e1',
            maxWidth: 1000,
          }}>
            {seo.landingDescription}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {BADGES[locale].map((badge) => (
              <div
                key={badge}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  border: '1px solid rgba(226,232,240,0.32)',
                  background: 'rgba(15,23,42,0.55)',
                  color: '#e2e8f0',
                  padding: '10px 18px',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {badge}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              background: '#f59e0b',
              color: '#111827',
              padding: '10px 18px',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            {ctaLabel}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
