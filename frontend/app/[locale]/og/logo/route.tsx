import { ImageResponse } from 'next/og'

import { getValidLocale } from '@/i18n/config'

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
          color: '#f8fafc',
          background:
            'radial-gradient(circle at 20% 18%, rgba(251,191,36,0.24), transparent 35%), radial-gradient(circle at 82% 90%, rgba(16,185,129,0.18), transparent 40%), #0f172a',
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
            background: '#f59e0b',
            color: '#111827',
            fontSize: 102,
            fontWeight: 800,
            boxShadow: '0 18px 42px -20px rgba(0,0,0,0.55)',
          }}
        >
          S
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.02em' }}>SafeTasks</span>
          <span style={{ fontSize: 24, color: '#cbd5e1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Production OS
          </span>
        </div>
        <span
          style={{
            marginTop: 8,
            border: '1px solid rgba(148,163,184,0.42)',
            borderRadius: 999,
            padding: '8px 14px',
            color: '#e2e8f0',
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
