import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  KitItem,
  KitItemCreate,
  KitItemUpdate,
  KitItemWithMaintenance,
  HealthStatus
} from '@/types'

const INVENTORY_KEY = 'inventory'

export function useInventoryItems(
  organizationId?: string,
  kitId?: string,
  category?: string,
  healthStatus?: HealthStatus
) {
  return useQuery({
    queryKey: [INVENTORY_KEY, organizationId, kitId, category, healthStatus],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      if (kitId) params.append('kit_id', kitId)
      if (category) params.append('category', category)
      if (healthStatus) params.append('health_status', healthStatus)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/inventory/items/?${queryString}` : '/api/v1/inventory/items/'
      return apiClient.get<KitItem[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useInventoryItem(itemId: string) {
  return useQuery({
    queryKey: [INVENTORY_KEY, itemId],
    queryFn: () => apiClient.get<KitItemWithMaintenance>(`/api/v1/inventory/items/${itemId}`),
    enabled: !!itemId,
  })
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: KitItemCreate) =>
      apiClient.post<KitItem>('/api/v1/inventory/items/', item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: KitItemUpdate }) =>
      apiClient.put<KitItem>(`/api/v1/inventory/items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`/api/v1/inventory/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}
