'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { defaultLocale, locales } from '@/i18n/config'

function normalizeLocale(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : ''
  return locales.includes(value as any) ? value : defaultLocale
}

function sanitizeRedirectTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  // Prevent open redirects.
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('://')) return null
  return value
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const locale = normalizeLocale(formData.get('locale'))

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  const redirectTo = sanitizeRedirectTo(formData.get('redirect_to'))
  // Default behavior: send to dashboard; AuthContext will redirect to onboarding if org is missing.
  redirect(redirectTo || `/${locale}/dashboard`)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const locale = normalizeLocale(formData.get('locale'))
  const redirectTo = sanitizeRedirectTo(formData.get('redirect_to')) || `/${locale}/onboarding`

  const fullName = formData.get('full_name')?.toString() || ''
  const companyName = formData.get('company_name')?.toString() || ''

  const userMetadata: Record<string, string> = { full_name: fullName }
  if (companyName) {
    userMetadata.company_name = companyName
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: userMetadata,
      // If email confirmation is enabled, ensure the user lands back on the intended flow.
      ...(appUrl ? { emailRedirectTo: `${appUrl}${redirectTo}` } : {}),
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')

  // If Supabase requires email confirmation, there may be no session yet.
  if (!signUpData?.session) {
    redirect(`/${locale}/auth/login?redirect=${encodeURIComponent(redirectTo)}&check_email=1`)
  }

  redirect(redirectTo)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email for password reset link' }
}
