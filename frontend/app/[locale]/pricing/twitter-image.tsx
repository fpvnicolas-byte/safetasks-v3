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

export default async function PricingTwitterImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const kicker = locale === 'pt-br' ? 'Planos por tamanho de equipe' : 'Plans by team size'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(160deg, #111827 0%, #0f172a 55%, #1f2937 100%)',
          color: '#f8fafc',
          padding: '56px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span
            style={{
              border: '1px solid rgba(251,191,36,0.45)',
              borderRadius: 999,
              padding: '9px 16px',
              alignSelf: 'flex-start',
              color: '#fcd34d',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'rgba(245,158,11,0.15)',
            }}
          >
            {kicker}
          </span>
          <span style={{ fontSize: 30, color: '#cbd5e1', fontWeight: 500 }}>SafeTasks</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.06,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {seo.pricingTitle}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.28,
              color: '#cbd5e1',
            }}
          >
            {seo.pricingDescription}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(148,163,184,0.35)',
            paddingTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#e2e8f0',
          }}
        >
          <span>SafeTasks Production OS</span>
          <span>{locale.toUpperCase()}</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
