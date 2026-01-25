/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-url.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  // Disable optimizeCss to fix critters module issue
  // experimental: {
  //   optimizeCss: true,
  // },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_BACKEND_URL
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/:path*`
          : 'http://localhost:8000/api/v1/:path*',
      },
    ]
  },
}

module.exports = nextConfig
