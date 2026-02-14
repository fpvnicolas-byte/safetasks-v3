import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { AuthProvider } from '@/contexts/AuthContext'
import { BillingProvider } from '@/contexts/BillingContext'
import type { Metadata } from 'next'
import type { Profile } from '@/contexts/AuthContext'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type ProfileRow = Pick<
  Profile,
  'id' | 'email' | 'organization_id' | 'role' | 'role_v2' | 'full_name' | 'avatar_url' | 'is_active' | 'is_master_owner'
>

const legacyRoleMap: Record<string, string> = {
  admin: 'admin',
  manager: 'producer',
  crew: 'freelancer',
  viewer: 'freelancer',
}

function toEffectiveRole(profile: Pick<Profile, 'is_master_owner' | 'role_v2' | 'role'>): string {
  if (profile.is_master_owner) return 'owner'
  if (profile.role_v2) return profile.role_v2
  return legacyRoleMap[profile.role] || 'finance'
}

async function resolveInitialProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,organization_id,role,role_v2,full_name,avatar_url,is_active,is_master_owner')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (error || !data) {
    return null
  }

  return {
    ...data,
    effective_role: toEffectiveRole(data),
  }
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Server-side auth check — redirect unauthenticated users before any JS loads.
  // This duplicates the middleware check intentionally (defense in depth) and
  // eliminates the client-side "Loading..." screen for unauthenticated visitors.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const initialProfile = await resolveInitialProfile(supabase, user)

  return (
    <AuthProvider initialUser={user} initialProfile={initialProfile}>
      <BillingProvider>
        <DashboardShell>{children}</DashboardShell>
      </BillingProvider>
    </AuthProvider>
  )
}
