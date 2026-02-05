import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

interface FileMetadata {
  name: string
  path: string
  bucket: string
  size?: number
  created_at?: string
  is_public: boolean
}

export function useFiles(module: string, organizationId?: string, entityId?: string) {
  return useQuery({
    queryKey: ['files', module, organizationId, entityId],
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }
      const params = entityId ? `?entity_id=${entityId}` : ''
      return apiClient.get<FileMetadata[]>(`/api/v1/storage/list/${module}${params}`)
    },
    enabled: !!organizationId && !!module,
  })
}