import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  // 1. Run Core i18n Middleware
  const intlResponse = intlMiddleware(request);

  // DEBUGGING: Log middleware execution
  console.log('[Middleware] Processing:', request.nextUrl.pathname);

  // If i18n redirects (e.g. / -> /en), return immediately
  if (intlResponse.headers.has('Location')) {
    console.log('[Middleware] i18n Redirecting to:', intlResponse.headers.get('Location'));
    return intlResponse;
  }

  const pathname = request.nextUrl.pathname;
  const localePattern = new RegExp(`^/(${locales.join('|')})`);
  const pathWithoutLocale = pathname.replace(localePattern, '');

  // Public metadata/preview assets should not pay auth overhead.
  const publicMetadataAssetPaths = [
    '/opengraph-image',
    '/twitter-image',
    '/og/logo',
    '/pricing/opengraph-image',
    '/pricing/twitter-image',
  ];
  const isPublicMetadataAsset = publicMetadataAssetPaths.some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`)
  );
  if (isPublicMetadataAsset) {
    return NextResponse.next({
      request,
      headers: intlResponse.headers,
    });
  }

  // 2. Setup Supabase Client
  let supabaseResponse = NextResponse.next({
    request,
    headers: intlResponse.headers, // propagate intl headers
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Auth Logic
  const { data: { user } } = await supabase.auth.getUser()

  // 4. Protected Routes Logic
  // We strip locale to check path groups

  const protectedRoutes = ['/dashboard', '/projects', '/financials', '/settings', '/onboarding', '/platform']
  const isProtectedRoute = protectedRoutes.some(route =>
    pathWithoutLocale.startsWith(route)
  )

  if (isProtectedRoute && !user) {
    // Redirect to login, preserving locale
    const localeMatch = pathname.match(localePattern)?.[1];
    const locale = localeMatch || defaultLocale;
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/auth/login`
    url.searchParams.set('redirect', pathname)
    console.log('[Middleware] Protected Route Redirect -> Login:', url.pathname);
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from auth pages
  // NOTE: Some auth routes must remain accessible even when authenticated
  // (e.g. accepting an invite before the user belongs to an organization).
  const authRoutesAllowedWhenLoggedIn = ['/auth/accept-invite', '/auth/callback']
  const isAuthRoute = pathWithoutLocale.startsWith('/auth/')
  const isAllowedAuthRoute = authRoutesAllowedWhenLoggedIn.some((route) =>
    pathWithoutLocale.startsWith(route)
  )

  if (user && isAuthRoute && !isAllowedAuthRoute) {
    const localeMatch = pathname.match(localePattern)?.[1];
    const locale = localeMatch || defaultLocale;
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    console.log('[Middleware] Auth Page Redirect -> Dashboard:', url.pathname);
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // However, match all pathnames within `/users` (if strictly needed)
    // '/([\\w-]+)?/users/(.+)'
  ]
};
