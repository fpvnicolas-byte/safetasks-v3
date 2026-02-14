/**
 * Financial utilities for working with cents-based currency
 * All backend financial values are stored as integers in cents
 */
import { getLocaleFromPathname } from '@/i18n/config'

type SupportedIntlLocale = 'en-US' | 'pt-BR'

function normalizeLocale(locale?: string): SupportedIntlLocale {
  if (!locale) return 'en-US'

  const normalized = locale.toLowerCase().replace('_', '-')
  if (normalized === 'pt' || normalized.startsWith('pt-br')) {
    return 'pt-BR'
  }

  return 'en-US'
}

function inferLocaleFromPathname(): SupportedIntlLocale {
  if (typeof window === 'undefined') {
    return 'en-US'
  }

  const routeLocale = getLocaleFromPathname(window.location.pathname)
  return routeLocale === 'pt-br' ? 'pt-BR' : 'en-US'
}

function getDefaultCurrency(locale: SupportedIntlLocale): string {
  return locale === 'pt-BR' ? 'BRL' : 'USD'
}

/**
 * Convert a currency amount to cents (integer)
 * @example toCents(99.99) => 9999
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Convert cents (integer) to a currency amount
 * @example fromCents(9999) => 99.99
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/** @deprecated Use toCents() */
export const dollarsToCents = toCents
/** @deprecated Use fromCents() */
export const centsToDollars = fromCents

/**
 * Format cents as currency string
 * @example formatCurrency(9999, undefined, 'en') => "$99.99"
 * @example formatCurrency(9999, undefined, 'pt-br') => "R$ 99,99"
 */
export function formatCurrency(cents: number, currency?: string, locale?: string): string {
  const dollars = fromCents(cents)
  const resolvedLocale = locale ? normalizeLocale(locale) : inferLocaleFromPathname()
  const resolvedCurrency = currency || getDefaultCurrency(resolvedLocale)

  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency: resolvedCurrency,
  }).format(dollars)
}

/**
 * Parse currency input string to cents
 * Handles: "99.99", "$99.99", "99", "99.9"
 * @example parseCurrencyInput("$99.99") => 9999
 */
export function parseCurrencyInput(input: string): number {
  // Remove currency symbols and commas
  const cleaned = input.replace(/[$,]/g, '').trim()
  const dollars = parseFloat(cleaned)

  if (isNaN(dollars)) {
    throw new Error('Invalid currency input')
  }

  return toCents(dollars)
}

/**
 * Validate currency input
 * Returns true if input is a valid currency string
 */
export function isValidCurrencyInput(input: string): boolean {
  try {
    parseCurrencyInput(input)
    return true
  } catch {
    return false
  }
}
