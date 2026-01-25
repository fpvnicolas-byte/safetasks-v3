/**
 * Time utilities for working with HH:MM:SS format
 * All backend time values use HH:MM:SS format
 */

/**
 * Convert HH:MM or HH:MM:SS to HH:MM:SS format
 * @example normalizeTimeFormat("08:00") => "08:00:00"
 * @example normalizeTimeFormat("08:00:00") => "08:00:00"
 */
export function normalizeTimeFormat(time: string | null): string | null {
  if (!time) return null

  // Already in HH:MM:SS format
  if (time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return time
  }

  // Convert HH:MM to HH:MM:SS
  if (time.match(/^\d{2}:\d{2}$/)) {
    return `${time}:00`
  }

  // Invalid format
  throw new Error(`Invalid time format: ${time}`)
}

/**
 * Convert HH:MM:SS to HH:MM for HTML input
 * @example timeToInputFormat("08:00:00") => "08:00"
 */
export function timeToInputFormat(time: string | null): string {
  if (!time) return ''

  // Extract HH:MM from HH:MM:SS
  const match = time.match(/^(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

/**
 * Validate time string format
 * Accepts HH:MM or HH:MM:SS
 */
export function isValidTimeFormat(time: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time)
}

/**
 * Format time for display
 * @example formatTime("08:00:00") => "8:00 AM"
 */
export function formatTime(time: string | null, use24Hour: boolean = false): string {
  if (!time) return ''

  const [hours, minutes] = time.split(':').map(Number)

  if (use24Hour) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}
