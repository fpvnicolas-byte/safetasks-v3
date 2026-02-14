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

export default async function PricingTwitterImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const kicker = locale === 'pt-br' ? 'Planos por tamanho de equipe' : 'Plans by team size'
  const ctaLabel = locale === 'pt-br' ? 'Comece o teste de 7 dias' : 'Start 7-day trial'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `linear-gradient(160deg, ${OG_HEX_COLORS.surface} 0%, ${OG_HEX_COLORS.background} 55%, ${OG_HEX_COLORS.surfaceAlt} 100%)`,
          color: OG_HEX_COLORS.foreground,
          padding: '56px 64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span
            style={{
              border: `1px solid ${OG_ALPHA.warningBorder}`,
              borderRadius: 999,
              padding: '9px 16px',
              alignSelf: 'flex-start',
              color: OG_HEX_COLORS.warning,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: OG_ALPHA.warningChip,
            }}
          >
            {kicker}
          </span>
          <span style={{ fontSize: 30, color: OG_HEX_COLORS.muted, fontWeight: 500 }}>Produzo</span>
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
              color: OG_HEX_COLORS.muted,
            }}
          >
            {seo.pricingDescription}
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${OG_ALPHA.mutedBorderSoft}`,
            paddingTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: OG_HEX_COLORS.muted,
          }}
        >
          <span>{ctaLabel}</span>
          <span>{locale.toUpperCase()}</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
