'use client'

import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export interface Profile {
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

interface AuthProviderProps {
  children: React.ReactNode
  initialUser?: User | null
  initialProfile?: Profile | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organizationId: null,
  isLoading: true,
  refreshProfile: async () => { },
  signOut: async () => { },
})

export function AuthProvider({ children, initialUser = null, initialProfile = null }: AuthProviderProps) {
  const isSeeded = Boolean(initialUser && initialProfile)
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [organizationId, setOrganizationId] = useState<string | null>(initialProfile?.organization_id ?? null)
  const [isLoading, setIsLoading] = useState(!isSeeded)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const locale = useLocale()

  // Use refs to track current state for async callbacks (avoids stale closures)
  const profileRef = useRef<Profile | null>(initialProfile)
  const isSigningOutRef = useRef(false)
  const isFetchingProfileRef = useRef(false)

  const fetchProfile = useCallback(async (token: string) => {
    // Don't fetch if we're signing out
    if (isSigningOutRef.current) {
      return
    }

    // Prevent concurrent fetchProfile calls (race condition guard)
    if (isFetchingProfileRef.current) {
      return
    }
    isFetchingProfileRef.current = true

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/profiles/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      // Double-check we haven't started signing out while fetching
      if (isSigningOutRef.current) {
        return
      }

      if (response.ok) {
        const profileData = await response.json()
        setProfile(profileData)
        profileRef.current = profileData
        setOrganizationId(profileData.organization_id)

        if (!profileData.organization_id) {
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
          const shouldRedirect = !currentPath.includes('/onboarding') && !currentPath.includes('/auth/')
          if (shouldRedirect) {
            router.push(`/${locale}/onboarding`)
          }
        }
      } else {
        logger.error('Failed to fetch profile', undefined, { status: response.status, statusText: response.statusText })
      }
    } catch (error) {
      logger.error('Error fetching profile', error)
    } finally {
      isFetchingProfileRef.current = false
    }
  }, [locale, router])

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

  const signOut = useCallback(async () => {
    // Set signing out flag to prevent race conditions
    isSigningOutRef.current = true

    try {
      // Clear state first to update UI immediately
      setProfile(null)
      profileRef.current = null
      setOrganizationId(null)
      setUser(null)
      setIsLoading(false)

      // Then sign out from Supabase
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      logger.error('Error during sign out', error)
    } finally {
      clearSupabaseStorage()
      // Navigate after everything is cleared
      router.push(`/${locale}/auth/login`)
      // Reset flag after a delay to allow navigation to complete
      setTimeout(() => {
        isSigningOutRef.current = false
      }, 1000)
    }
  }, [supabase, locale, router])

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      // Don't run if signing out
      if (isSigningOutRef.current) return

      setIsLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      // CRITICAL: If no session from getSession (which checks local storage often),
      // try to force a refresh from the server/cookie.
      if (!session) {
        logger.info('[AuthContext] No initial session found, attempting refreshSession to check cookies...', {
          error: sessionError?.message,
        })
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshedSession && !isSigningOutRef.current) {
          logger.info('[AuthContext] Session recovered via refreshSession', { userId: refreshedSession.user.id })
          setUser(refreshedSession.user)
          await fetchProfile(refreshedSession.access_token)
        } else if (!isSigningOutRef.current) {
          logger.info('[AuthContext] No session after refresh attempt', { error: refreshError?.message })
          setProfile(null)
          profileRef.current = null
          setOrganizationId(null)
          setUser(null)
        }
      } else if (!isSigningOutRef.current) {
        setUser(session.user)
        // Fetch profile if user is authenticated
        await fetchProfile(session.access_token)
      }

      if (!isSigningOutRef.current) {
        setIsLoading(false)
      }
    }

    if (!isSeeded) {
      getSession()
    } else {
      setIsLoading(false)
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip processing if we're signing out
      if (isSigningOutRef.current) {
        logger.info(`[AuthContext] Ignoring auth event during sign out: ${event}`)
        return
      }

      logger.info(`[AuthContext] Auth State Change: ${event}`, { userId: session?.user?.id })

      if (event === 'SIGNED_OUT' || String(event) === 'PkceGrantFailed') {
        // Handle explicit sign out or failure
        setUser(null)
        setProfile(null)
        profileRef.current = null
        setOrganizationId(null)
        setIsLoading(false)
        return
      }

      // reliable session presence check
      if (session?.user) {
        setUser(session.user)

        // Use ref to check current profile state (avoids stale closure)
        const currentProfile = profileRef.current
        if (!currentProfile || currentProfile.id !== session.user.id) {
          setIsLoading(true)
          await fetchProfile(session.access_token)
          // Only set loading false if we haven't started signing out
          if (!isSigningOutRef.current) {
            setIsLoading(false)
          }
        }
      } else if (!session && event !== 'INITIAL_SESSION') {
        // If no session and not initial load, clear state
        logger.warn('[AuthContext] Session lost without explicit signout', { event })
        setUser(null)
        setProfile(null)
        profileRef.current = null
        setOrganizationId(null)
      }

      // Ensure loading is false after processing
      if (event === 'INITIAL_SESSION' && !isSigningOutRef.current) {
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile, isSeeded])

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
