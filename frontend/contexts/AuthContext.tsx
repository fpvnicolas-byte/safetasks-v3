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
  refreshProfile: async () => { },
  signOut: async () => { },
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
      const { data: { session }, error } = await supabase.auth.getSession()

      // CRITICAL: If no session from getSession (which checks local storage often), 
      // try to force a refresh from the server/cookie.
      if (!session) {
        logger.info('[AuthContext] No initial session found, attempting refreshSession to check cookies...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshedSession) {
          logger.info('[AuthContext] Session recovered via refreshSession', { userId: refreshedSession.user.id })
          setUser(refreshedSession.user)
          await fetchProfile(refreshedSession.access_token)
        } else {
          logger.info('[AuthContext] No session after refresh attempt', { error: refreshError?.message })
          setProfile(null)
          setOrganizationId(null)
          setUser(null)
        }
      } else {
        setUser(session.user)
        // Fetch profile if user is authenticated
        await fetchProfile(session.access_token)
      }

      setIsLoading(false)
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info(`[AuthContext] Auth State Change: ${event}`, { userId: session?.user?.id })

      if (event === 'SIGNED_OUT' || (event === 'PkceGrantFailed' as any)) { // Casting to any as PkceGrantFailed might not be in the type def yet depending on version
        // Handle explicit sign out or failure
        setUser(null)
        setProfile(null)
        setOrganizationId(null)
        setIsLoading(false)
        return
      }

      // reliable session presence check
      if (session?.user) {
        setUser(session.user)

        // Optimize: Only fetch profile if not already loaded or if user changed
        if (!profile || profile.id !== session.user.id) {
          setIsLoading(true) // Only set loading if we need to fetch
          await fetchProfile(session.access_token)
          setIsLoading(false)
        }
      } else if (!session && event !== 'INITIAL_SESSION') {
        // If no session and not initial load (which usually has session or null, handled by getSession above), 
        // we might want to clear but be careful about transient states. 
        // However, onAuthStateChange is usually authoritative.
        // If we are strictly missing session and it's not a refresh, we clear.
        if (user) {
          logger.warn('[AuthContext] Session lost without explicit signout', { event })
          setUser(null)
          setProfile(null)
          setOrganizationId(null)
        }
      }

      // Ensure loading is false after processing
      // Note: we don't want to flicker isLoading on every token refresh
      if (event === 'INITIAL_SESSION') {
        setIsLoading(false)
      }
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
