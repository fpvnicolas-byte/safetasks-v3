'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Bug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const sections = [
    {
        key: 'bugReports',
        href: '/platform/bug-reports',
        icon: Bug,
        color: 'bg-destructive/15 text-destructive',
    },
]

export default function PlatformPage() {
    const locale = useLocale()
    const t = useTranslations('platform.dashboard')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
                <p className="text-muted-foreground">{t('subtitle')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sections.map((section) => {
                    const Icon = section.icon
                    return (
                        <Link key={section.key} href={`/${locale}${section.href}`}>
                            <Card className="group h-full cursor-pointer transition-colors hover:border-primary">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${section.color}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                {t(`sections.${section.key}.title`)}
                                            </CardTitle>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription>
                                        {t(`sections.${section.key}.desc`)}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
