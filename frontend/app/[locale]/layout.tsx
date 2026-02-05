import { AuthProvider } from '@/contexts/AuthContext'
import { BillingProvider } from '@/contexts/BillingContext'
import { QueryProvider } from '@/lib/api/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { locales, isValidLocale, defaultLocale, type Locale } from '@/i18n/config'
import '../globals.css'

export const metadata = {
  title: 'SafeTasks V3 - Film Production Management',
  description: 'Professional film production management platform',
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

import { SpeedInsights } from "@vercel/speed-insights/next"

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Ensure that the incoming `locale` is valid
  if (!isValidLocale(locale)) {
    notFound();
  }

  // Explicitly load messages to avoid plugin config issues
  let messages;
  try {
    // We use a relative path from the app/[locale] folder to the messages folder
    // Adjust depth: app/[locale] -> app -> frontend -> messages
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error('[Layout] Failed to load messages for locale:', locale, error);
    // Try to fall back to default locale
    if (locale !== defaultLocale) {
      try {
        messages = (await import(`../../messages/${defaultLocale}.json`)).default;
      } catch (fallbackError) {
        console.error('[Layout] Failed to load fallback messages:', fallbackError);
        notFound();
      }
    } else {
      notFound();
    }
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <AuthProvider>
                <BillingProvider>{children}</BillingProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
