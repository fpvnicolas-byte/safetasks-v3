import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../client'

const PLATFORM_ADMIN_QUERY_KEY = ['platform', 'is-admin'] as const

export function useIsPlatformAdmin(enabled: boolean) {
  return useQuery({
    queryKey: PLATFORM_ADMIN_QUERY_KEY,
    queryFn: async () => {
      try {
        await apiClient.get('/api/v1/platform/bug-reports/?limit=1')
        return true
      } catch {
        return false
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
