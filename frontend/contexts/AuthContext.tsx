'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

interface Profile {
  id: string
  email: string
  organization_id: string | null
  role: string
  role_v2?: string | null
  effective_role?: string
  full_name: string | null
  avatar_url: string | null
  is_active: boolean
  is_master_owner?: boolean
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  organizationId: string | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organizationId: null,
  isLoading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const fetchProfile = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/profiles/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const profileData = await response.json()
        setProfile(profileData)
        setOrganizationId(profileData.organization_id)

        if (!profileData.organization_id) {
          const shouldRedirect = pathname
            ? !pathname.includes('/onboarding') && !pathname.includes('/auth/')
            : true
          if (shouldRedirect) {
            router.push(`/${locale}/onboarding`)
          }
        }
      } else {
        logger.error('Failed to fetch profile', undefined, { status: response.status, statusText: response.statusText })
      }
    } catch (error) {
      logger.error('Error fetching profile', error)
    }
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await fetchProfile(session.access_token)
    }
  }

  const clearSupabaseStorage = () => {
    if (typeof window === 'undefined') return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/i)
    const ref = match?.[1]
    const storage = window.localStorage
    const session = window.sessionStorage

    const shouldClear = (key: string) =>
      ref ? key.startsWith(`sb-${ref}`) : key.startsWith('sb-')

    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i)
      if (key && shouldClear(key)) {
        storage.removeItem(key)
      }
    }

    for (let i = session.length - 1; i >= 0; i -= 1) {
      const key = session.key(i)
      if (key && shouldClear(key)) {
        session.removeItem(key)
      }
    }

    // Clear Supabase auth cookies (supabase/ssr uses cookies for auth)
    const cookiePrefix = ref ? `sb-${ref}` : 'sb-'
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0]?.trim()
      if (name && name.startsWith(cookiePrefix)) {
        document.cookie = `${name}=; Max-Age=0; path=/`
      }
    })
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      clearSupabaseStorage()
      setProfile(null)
      setOrganizationId(null)
      setUser(null)
      router.push(`/${locale}/auth/login`)
    }
  }

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      // Fetch profile if user is authenticated
      if (session?.access_token) {
        await fetchProfile(session.access_token)
      } else {
        setProfile(null)
        setOrganizationId(null)
      }

      setIsLoading(false)
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth State Change:', event, session?.user?.id);
      setIsLoading(true)
      setUser(session?.user ?? null)

      // Fetch profile when user logs in
      if (session?.access_token) {
        await fetchProfile(session.access_token)
      } else {
        // Clear profile when user logs out
        setProfile(null)
        setOrganizationId(null)
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, profile, organizationId, isLoading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
