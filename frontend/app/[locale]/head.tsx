import { getValidLocale } from '@/i18n/config'
import { getAbsoluteUrl, getOpenGraphLogoPath } from '@/lib/seo'

interface HeadProps {
  params: Promise<{ locale: string }>
}

export default async function Head({ params }: HeadProps) {
  const { locale: requestedLocale } = await params
  const locale = getValidLocale(requestedLocale)
  const logoUrl = getAbsoluteUrl(getOpenGraphLogoPath(locale))

  return (
    <>
      <meta property="og:logo" content={logoUrl} />
      <meta property="og:logo:secure_url" content={logoUrl} />
      <meta property="og:logo:type" content="image/png" />
      <meta property="og:logo:width" content="512" />
      <meta property="og:logo:height" content="512" />
    </>
  )
}
