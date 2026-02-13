'use client'

import { useLocale } from 'next-intl'
import { redirect } from 'next/navigation'

export default function PlatformPage() {
    const locale = useLocale()
    redirect(`/${locale}/platform/bug-reports`)
}
