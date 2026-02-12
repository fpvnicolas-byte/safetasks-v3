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

export default async function TwitterImage({ params }: ImageProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const seo = getSeoCopy(locale)

  const kicker = locale === 'pt-br' ? 'Plataforma para produtoras audiovisuais' : 'Platform for audiovisual production teams'
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
          background: `linear-gradient(145deg, ${OG_HEX_COLORS.background} 0%, ${OG_HEX_COLORS.surface} 45%, ${OG_HEX_COLORS.surfaceAlt} 100%)`,
          color: OG_HEX_COLORS.foreground,
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
          background: OG_ALPHA.warningChip,
          color: OG_HEX_COLORS.warning,
          border: `1px solid ${OG_ALPHA.warningBorder}`,
          fontSize: 18,
          padding: '9px 16px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}>
          {kicker}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
          <div style={{ fontSize: 32, color: OG_HEX_COLORS.muted, fontWeight: 500 }}>SafeTasks</div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 64,
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            fontWeight: 700,
          }}>
            {seo.landingTitle}
          </div>
          <div style={{ fontSize: 30, color: OG_HEX_COLORS.muted, lineHeight: 1.3 }}>
            {seo.landingDescription}
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${OG_ALPHA.mutedBorderSoft}`,
          paddingTop: 22,
          fontSize: 24,
          color: OG_HEX_COLORS.muted,
        }}>
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
