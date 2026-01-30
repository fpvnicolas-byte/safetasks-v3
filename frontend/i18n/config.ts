/**
 * Centralized i18n configuration
 * Single source of truth for all internationalization settings
 */

export const locales = ['en', 'pt-br'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  'pt-br': 'Português BR',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  'pt-br': '🇧🇷',
};

/**
 * Check if a string is a valid locale
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Get a valid locale from a string, returning default if invalid
 */
export function getValidLocale(locale: string | undefined): Locale {
  if (!locale) return defaultLocale;
  return isValidLocale(locale) ? locale : defaultLocale;
}

/**
 * Get the locale prefix for URLs
 * Returns empty string for default locale, or /locale for others
 */
export function getLocalePrefix(locale: Locale): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}

/**
 * Build a localized path
 */
export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${locale}/${cleanPath}`;
}

/**
 * Extract locale from pathname
 */
export function getLocaleFromPathname(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean);
  const potentialLocale = segments[0];
  return isValidLocale(potentialLocale) ? potentialLocale : null;
}
