import { AuthProvider } from '@/contexts/AuthContext'
import { BillingProvider } from '@/contexts/BillingContext'
import { QueryProvider } from '@/lib/api/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import {
  SITE_NAME,
  getAbsoluteUrl,
  getLandingOpenGraphImagePath,
  getLandingTwitterImagePath,
  getOpenGraphLogoPath,
  getSeoCopy,
  getSiteUrl,
} from '@/lib/seo'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { defaultLocale, isValidLocale, locales } from '@/i18n/config'
import '../globals.css'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Pick<LocaleLayoutProps, 'params'>): Promise<Metadata> {
  const { locale: requestedLocale } = await params
  const locale = isValidLocale(requestedLocale) ? requestedLocale : defaultLocale
  const seo = getSeoCopy(locale)
  const landingOgImageUrl = getAbsoluteUrl(getLandingOpenGraphImagePath(locale))
  const landingTwitterImageUrl = getAbsoluteUrl(getLandingTwitterImagePath(locale))
  const logoImageUrl = getAbsoluteUrl(getOpenGraphLogoPath(locale))

  return {
    metadataBase: new URL(getSiteUrl()),
    applicationName: SITE_NAME,
    title: seo.siteTitle,
    description: seo.siteDescription,
    openGraph: {
      title: seo.siteTitle,
      description: seo.siteDescription,
      siteName: SITE_NAME,
      locale: seo.openGraphLocale,
      type: 'website',
      images: [
        {
          url: landingOgImageUrl,
          width: 1200,
          height: 630,
          alt: seo.siteTitle,
        },
        {
          url: logoImageUrl,
          width: 512,
          height: 512,
          alt: `${SITE_NAME} logo`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.siteTitle,
      description: seo.siteDescription,
      images: [landingTwitterImageUrl],
    },
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  // Ensure that the incoming `locale` is valid
  if (!isValidLocale(locale)) {
    notFound();
  }

  // Explicitly load messages to avoid plugin config issues
  let messages: Record<string, unknown>;
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
                <BillingProvider>
                  {children}
                  <Toaster />
                </BillingProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
