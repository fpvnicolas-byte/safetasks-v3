import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Kit, KitCreate, KitUpdate } from '@/types'

const KITS_KEY = 'kits'

export function useKits(organizationId?: string) {
  return useQuery({
    queryKey: [KITS_KEY, organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      return apiClient.get<Kit[]>(`/api/v1/kits/?${params.toString()}`)
    },
    enabled: !!organizationId,
  })
}

export function useKit(kitId: string) {
  return useQuery({
    queryKey: [KITS_KEY, kitId],
    queryFn: () => apiClient.get<Kit>(`/api/v1/kits/${kitId}`),
    enabled: !!kitId,
  })
}

export function useCreateKit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (kit: KitCreate) =>
      apiClient.post<Kit>('/api/v1/kits/', kit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KITS_KEY] })
    },
  })
}

export function useUpdateKit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kitId, data }: { kitId: string; data: KitUpdate }) =>
      apiClient.put<Kit>(`/api/v1/kits/${kitId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KITS_KEY] })
    },
  })
}

export function useDeleteKit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (kitId: string) =>
      apiClient.delete(`/api/v1/kits/${kitId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KITS_KEY] })
    },
  })
}
