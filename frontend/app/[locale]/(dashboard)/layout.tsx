import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { AuthProvider } from '@/contexts/AuthContext'
import { BillingProvider } from '@/contexts/BillingContext'
import type { Metadata } from 'next'

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

  return (
    <AuthProvider>
      <BillingProvider>
        <DashboardShell>{children}</DashboardShell>
      </BillingProvider>
    </AuthProvider>
  )
}
