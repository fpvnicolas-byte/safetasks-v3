/**
 * Financial utilities for working with cents-based currency
 * All backend financial values are stored as integers in cents
 */

/**
 * Convert dollars to cents (integer)
 * @example dollarsTo Cents(99.99) => 9999
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Convert cents (integer) to dollars
 * @example centsToDollars(9999) => 99.99
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Format cents as currency string
 * @example formatCurrency(9999) => "$99.99"
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const dollars = centsToDollars(cents)
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

  return dollarsToCents(dollars)
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
