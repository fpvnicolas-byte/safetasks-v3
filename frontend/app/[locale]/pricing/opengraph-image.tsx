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

export default async function PricingOpenGraphImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const planLabels = locale === 'pt-br'
    ? ['Starter', 'Professional', 'Anual', 'Enterprise']
    : ['Starter', 'Professional', 'Annual', 'Enterprise']

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'radial-gradient(circle at 80% 10%, rgba(245,158,11,0.25), transparent 40%), radial-gradient(circle at 15% 90%, rgba(56,189,248,0.2), transparent 35%), #111827',
          color: '#f8fafc',
          padding: '52px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>SafeTasks Pricing</span>
            <span style={{ fontSize: 18, color: '#cbd5e1' }}>Production OS</span>
          </div>
          <span
            style={{
              border: '1px solid rgba(148,163,184,0.45)',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 18,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#e2e8f0',
            }}
          >
            {locale.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.05,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {planLabels.map((label) => (
            <span
              key={label}
              style={{
                border: '1px solid rgba(226,232,240,0.32)',
                borderRadius: 999,
                padding: '10px 16px',
                background: 'rgba(15,23,42,0.6)',
                color: '#f8fafc',
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
