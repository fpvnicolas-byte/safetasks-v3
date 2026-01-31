'use client'

import { useCallback } from 'react'
import { useBilling } from '@/contexts/BillingContext'
import { ApiError } from '@/types'

/**
 * Hook that wraps async operations and automatically shows upgrade modal on 402 errors
 */
export function useBillingGuard() {
  const { showUpgradeModal } = useBilling()

  const guardedCall = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn()
      } catch (error) {
        // Check if it's a 402 Payment Required error
        if ((error as ApiError).statusCode === 402) {
          const message = (error as ApiError).message || 'Plan limit reached. Please upgrade to continue.'
          showUpgradeModal(message)
          return null
        }
        // Re-throw non-402 errors
        throw error
      }
    },
    [showUpgradeModal]
  )

  return { guardedCall }
}
