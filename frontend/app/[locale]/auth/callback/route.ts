import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getValidLocale } from '@/i18n/config'

function normalizeLocale(raw: string | undefined): string {
  const value = (raw || '').trim()
  return getValidLocale(value)
}

function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  // Prevent open redirects.
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('://')) return null
  return value
}

export async function GET(
  request: NextRequest,
  context: { params: { locale?: string } }
) {
  const locale = normalizeLocale(context.params?.locale)
  const url = request.nextUrl

  const code = url.searchParams.get('code')
  const nextParam = sanitizeNext(url.searchParams.get('next'))
  const nextPath = nextParam || `/${locale}/dashboard`

  // When using Supabase SSR (flowType=pkce), we must exchange the "code" for a session
  // and persist it to cookies before redirecting to protected pages.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      const loginUrl = new URL(`/${locale}/auth/login`, url.origin)
      loginUrl.searchParams.set('redirect', nextPath)
      loginUrl.searchParams.set('auth_error', '1')
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(new URL(nextPath, url.origin))
}
