import { ImageResponse } from 'next/og'

import { getValidLocale } from '@/i18n/config'
import { OG_ALPHA, OG_HEX_COLORS } from '@/lib/og-colors'
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
  const headline =
    locale === 'pt-br'
      ? 'Escolha o plano da sua produtora'
      : 'Choose your production plan'
  const ctaLabel = locale === 'pt-br' ? 'Comece o teste de 7 dias' : 'Start 7-day trial'

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
          background: `radial-gradient(circle at 80% 10%, ${OG_ALPHA.warningGlow}, transparent 40%), radial-gradient(circle at 15% 90%, ${OG_ALPHA.infoGlow}, transparent 35%), ${OG_HEX_COLORS.surface}`,
          color: OG_HEX_COLORS.foreground,
          padding: '52px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>Produzo Pricing</span>
            <span style={{ fontSize: 18, color: OG_HEX_COLORS.muted }}>Production OS</span>
          </div>
          <span
            style={{
              border: `1px solid ${OG_ALPHA.mutedBorder}`,
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 18,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: OG_HEX_COLORS.muted,
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
            {headline}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.28,
              color: OG_HEX_COLORS.muted,
            }}
          >
            {seo.pricingDescription}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {planLabels.map((label) => (
              <span
                key={label}
                style={{
                  border: `1px solid ${OG_ALPHA.mutedBorderSofter}`,
                  borderRadius: 999,
                  padding: '10px 16px',
                  background: OG_ALPHA.surfaceTint,
                  color: OG_HEX_COLORS.foreground,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div
            style={{
              borderRadius: 999,
              padding: '10px 16px',
              background: OG_HEX_COLORS.primary,
              color: OG_HEX_COLORS.background,
              fontSize: 17,
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
