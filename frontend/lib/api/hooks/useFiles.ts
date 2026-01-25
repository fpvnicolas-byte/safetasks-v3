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

export function useFiles(module: string, organizationId?: string) {
  return useQuery({
    queryKey: ['files', module, organizationId],
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }
      return apiClient.get<FileMetadata[]>(`/api/v1/storage/list/${module}`)
    },
    enabled: !!organizationId && !!module,
  })
}