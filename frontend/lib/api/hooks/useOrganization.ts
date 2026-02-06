import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Organization } from '@/types'

const ORGANIZATION_KEY = 'organization'

export function useOrganization(organizationId?: string) {
  return useQuery({
    queryKey: [ORGANIZATION_KEY, organizationId],
    queryFn: () => apiClient.get<Organization>('/api/v1/organizations/me'),
    enabled: !!organizationId,
  })
}

