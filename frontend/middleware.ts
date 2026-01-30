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

  // Extract path without locale for logic checks
  // e.g. /en/dashboard -> /dashboard
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}`) && pathname !== `/${locale}`
  );

  // 4. Protected Routes Logic
  // We need to strip locale to check path
  const localePattern = new RegExp(`^/(${locales.join('|')})`);
  const pathWithoutLocale = pathname.replace(localePattern, '');

  const protectedRoutes = ['/dashboard', '/projects', '/call-sheets', '/financials', '/settings']
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
  if (user && pathWithoutLocale.startsWith('/auth/')) {
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
