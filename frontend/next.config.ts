import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-url.supabase.co'],
  },
  eslint: {
    // Allow production builds to complete even with lint issues.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even with type errors.
    ignoreBuildErrors: true,
  },
  experimental: {
    // optimizeCss requires 'critters' and is incompatible with App Router streaming
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_BACKEND_URL
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/:path*`
          : 'http://127.0.0.1:8000/api/v1/:path*',
      },
    ]
  },
  async redirects() {
    return [
      // Redirect old stakeholders, suppliers, team routes to unified contacts page
      {
        source: '/:locale/stakeholders/:path*',
        destination: '/:locale/contacts',
        permanent: true,
      },
      {
        source: '/:locale/stakeholders',
        destination: '/:locale/contacts',
        permanent: true,
      },
      {
        source: '/:locale/suppliers/:path*',
        destination: '/:locale/contacts',
        permanent: true,
      },
      {
        source: '/:locale/suppliers',
        destination: '/:locale/contacts',
        permanent: true,
      },
      {
        source: '/:locale/team',
        destination: '/:locale/contacts',
        permanent: true,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
