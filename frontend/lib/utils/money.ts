/**
 * Financial utilities for working with cents-based currency
 * All backend financial values are stored as integers in cents
 */

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
 * @example formatCurrency(9999) => "$99.99"
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const dollars = fromCents(cents)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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
