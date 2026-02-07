'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useAcceptInvite } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, AlertTriangle, Mail } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { ApiError } from '@/types'

type PageState = 'loading' | 'no-token' | 'not-logged-in' | 'accepting' | 'success' | 'error'

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const locale = useLocale()
  const router = useRouter()
  const { user, profile, isLoading: authLoading, refreshProfile } = useAuth()
  const acceptInvite = useAcceptInvite()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const hasAttempted = useRef(false)

  useEffect(() => {
    if (!token) {
      setPageState('no-token')
      return
    }

    if (authLoading) {
      setPageState('loading')
      return
    }

    if (!user) {
      setPageState('not-logged-in')
      return
    }

    // User is logged in
    if (profile?.organization_id) {
      setPageState('error')
      setErrorMessage('You already belong to an organization.')
      return
    }

    // Auto-accept once
    if (!hasAttempted.current) {
      hasAttempted.current = true
      setPageState('accepting')

      acceptInvite.mutate(token, {
        onSuccess: async (data) => {
          setPageState('success')
          await refreshProfile()
          const nextPath =
            data?.role_v2 === 'freelancer' ? `/${locale}/projects` : `/${locale}/dashboard`
          setTimeout(() => {
            router.push(nextPath)
          }, 1500)
        },
        onError: (err: unknown) => {
          setPageState('error')
          const status = (err as Partial<ApiError>)?.statusCode
          const message = (err as Partial<ApiError>)?.message
          if (status === 410) {
            setErrorMessage('This invite has expired. Ask the team admin to resend it.')
          } else if (status === 403) {
            setErrorMessage('This invite was sent to a different email address.')
          } else if (status === 409) {
            setErrorMessage('You already belong to an organization.')
          } else if (status === 402) {
            setErrorMessage('This organization has reached its member limit. Contact the team admin.')
          } else {
            setErrorMessage(message || 'Something went wrong. Please try again.')
          }
        },
      })
    }
  }, [token, authLoading, user, profile, acceptInvite, refreshProfile, router, locale])

  const tokenParam = token ? `?token=${token}` : ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/20 blur-[120px] motion-reduce:animate-none animate-blob" />
      <div
        className="pointer-events-none absolute bottom-12 left-[-10%] h-80 w-80 rounded-full bg-emerald-400/20 blur-[140px] motion-reduce:animate-none animate-blob"
        style={{ animationDelay: '2s' }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-white/10 bg-slate-900/80 text-slate-100 shadow-2xl backdrop-blur">
          {pageState === 'loading' && (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300 mb-4" />
              <p className="text-slate-400">Loading...</p>
            </CardContent>
          )}

          {pageState === 'no-token' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Invalid Invite Link
                </CardTitle>
                <CardDescription className="text-slate-400">
                  This link does not contain a valid invite token.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200">
                  <Link href={`/${locale}/auth/login`}>Go to Login</Link>
                </Button>
              </CardFooter>
            </>
          )}

          {pageState === 'not-logged-in' && (
            <>
              <CardHeader className="text-center">
                <Mail className="h-10 w-10 text-amber-300 mx-auto mb-2" />
                <CardTitle>You&apos;ve Been Invited</CardTitle>
                <CardDescription className="text-slate-400">
                  Create an account to accept this invitation and join the team.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col gap-3">
                <Button asChild className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200">
                  <Link href={`/${locale}/auth/register${tokenParam}`}>Create Account</Link>
                </Button>
                <div className="text-sm text-center text-slate-400">
                  Already have an account?{' '}
                  <Link href={`/${locale}/auth/login${tokenParam}`} className="text-amber-300 hover:text-amber-200">
                    Sign in
                  </Link>
                </div>
              </CardFooter>
            </>
          )}

          {pageState === 'accepting' && (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300 mb-4" />
              <p className="text-slate-400">Accepting invite...</p>
            </CardContent>
          )}

          {pageState === 'success' && (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-10 w-10 text-emerald-400 mb-4" />
              <p className="text-lg font-medium">Welcome to the team!</p>
              <p className="text-slate-400 text-sm mt-1">Redirecting...</p>
            </CardContent>
          )}

          {pageState === 'error' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  Unable to Accept Invite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 text-destructive-foreground">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-amber-300 text-slate-900 hover:bg-amber-200">
                  <Link href={`/${locale}/dashboard`}>Go to Dashboard</Link>
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
