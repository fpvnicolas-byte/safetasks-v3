'use client';

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Film, Calendar, DollarSign, Users } from 'lucide-react'
import { useTranslations } from 'next-intl';

export default function LandingPage() {
    const t = useTranslations('landing');

    return (
        <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
            {/* Hero Section */}
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-6xl font-bold tracking-tight mb-4">
                        {t('title')}
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8">
                        {t('subtitle')}
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Button size="lg" asChild>
                            <Link href="/auth/register">{t('getStarted')}</Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <Link href="/auth/login">{t('signIn')}</Link>
                        </Button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-16">
                    <Card>
                        <CardHeader>
                            <Film className="h-10 w-10 mb-2 text-blue-500 dark:text-blue-400" />
                            <CardTitle>{t('features.projectManagement.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                {t('features.projectManagement.description')}
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Calendar className="h-10 w-10 mb-2 text-green-500 dark:text-green-400" />
                            <CardTitle>{t('features.callSheets.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                {t('features.callSheets.description')}
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <DollarSign className="h-10 w-10 mb-2 text-yellow-500 dark:text-yellow-400" />
                            <CardTitle>{t('features.financials.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                {t('features.financials.description')}
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Users className="h-10 w-10 mb-2 text-purple-500 dark:text-purple-400" />
                            <CardTitle>{t('features.team.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                {t('features.team.description')}
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>

                {/* CTA Section */}
                <Card className="bg-muted/50 border-muted">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{t('cta.title')}</CardTitle>
                        <CardDescription className="text-lg">
                            {t('cta.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button size="lg" asChild>
                            <Link href="/auth/register">{t('createAccount')}</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Footer */}
            <footer className="border-t py-8">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>{t('footer')}</p>
                </div>
            </footer>
        </div>
    )
}
