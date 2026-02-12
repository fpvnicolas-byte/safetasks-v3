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

export default async function TwitterImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const kicker = locale === 'pt-br' ? 'Plataforma para produtoras audiovisuais' : 'Platform for audiovisual production teams'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(145deg, #0f172a 0%, #111827 45%, #1e293b 100%)',
          color: '#f8fafc',
          padding: '56px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          borderRadius: 999,
          background: 'rgba(245,158,11,0.2)',
          color: '#fcd34d',
          border: '1px solid rgba(245,158,11,0.45)',
          fontSize: 18,
          padding: '9px 16px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}>
          {kicker}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
          <div style={{ fontSize: 32, color: '#cbd5e1', fontWeight: 500 }}>SafeTasks</div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 64,
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            fontWeight: 700,
          }}>
            {seo.pricingTitle}
          </div>
          <div style={{ fontSize: 30, color: '#cbd5e1', lineHeight: 1.3 }}>
            {seo.pricingDescription}
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(148,163,184,0.35)',
          paddingTop: 22,
          fontSize: 24,
          color: '#e2e8f0',
        }}>
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
