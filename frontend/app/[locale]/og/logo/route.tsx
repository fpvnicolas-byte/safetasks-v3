import { ImageResponse } from 'next/og'

import { getValidLocale } from '@/i18n/config'
import { OG_ALPHA, OG_HEX_COLORS } from '@/lib/og-colors'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const localeLabel = locale === 'pt-br' ? 'PT-BR' : 'EN'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          color: OG_HEX_COLORS.foreground,
          background:
            `radial-gradient(circle at 20% 18%, ${OG_ALPHA.warningGlow}, transparent 35%), radial-gradient(circle at 82% 90%, ${OG_ALPHA.successGlow}, transparent 40%), ${OG_HEX_COLORS.background}`,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: 170,
            height: 170,
            borderRadius: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: OG_HEX_COLORS.primary,
            color: OG_HEX_COLORS.background,
            fontSize: 102,
            fontWeight: 800,
            boxShadow: `0 18px 42px -20px ${OG_ALPHA.shadow}`,
          }}
        >
          S
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.02em' }}>SafeTasks</span>
          <span style={{ fontSize: 24, color: OG_HEX_COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Production OS
          </span>
        </div>
        <span
          style={{
            marginTop: 8,
            border: `1px solid ${OG_ALPHA.mutedBorder}`,
            borderRadius: 999,
            padding: '8px 14px',
            color: OG_HEX_COLORS.muted,
            fontSize: 16,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {localeLabel}
        </span>
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  )
}
