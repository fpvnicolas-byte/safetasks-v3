'use client'

import Link from 'next/link'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function PlatformLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthProvider>
            <PlatformLayoutContent>{children}</PlatformLayoutContent>
        </AuthProvider>
    )
}

function PlatformLayoutContent({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const locale = useLocale()
    const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null)

    useEffect(() => {
        let cancelled = false

        const verifyAccess = async () => {
            if (isLoading) return

            if (!user) {
                router.replace(`/${locale}/auth/login`)
                return
            }

            try {
                await apiClient.get('/api/v1/platform/refunds/?limit=1')
                if (!cancelled) setIsPlatformAdmin(true)
            } catch {
                if (!cancelled) {
                    setIsPlatformAdmin(false)
                    router.replace(`/${locale}/dashboard`)
                }
            }
        }

        void verifyAccess()

        return () => {
            cancelled = true
        }
    }, [isLoading, user, router, locale])

    if (isLoading || isPlatformAdmin === null) {
        return (
            <div className="min-h-screen bg-background">
                <header className="border-b bg-card px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-7 w-36" />
                        <div className="flex gap-4">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </div>
                </header>
                <main className="container mx-auto p-6">
                    <Skeleton className="h-8 w-48 mb-6" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </main>
            </div>
        )
    }

    if (!isPlatformAdmin) {
        return null
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card px-6 py-4">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <Link href={`/${locale}/platform`} className="text-xl font-bold font-display hover:text-primary transition-colors">
                            Platform Admin
                        </Link>
                        <nav className="flex gap-4 text-sm">
                            <Link href={`/${locale}/platform/refunds`} className="hover:text-primary">
                                Refunds Queue
                            </Link>
                            <Link href={`/${locale}/platform/bug-reports`} className="hover:text-primary">
                                Bug Reports
                            </Link>
                        </nav>
                    </div>
                    <Link href={`/${locale}/dashboard`}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>
            </header>
            <main className="p-6">
                {children}
            </main>
        </div>
    )
}
