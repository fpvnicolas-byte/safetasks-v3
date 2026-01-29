import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierWithTransactions,
  SupplierStatement
} from '@/types'

const SUPPLIERS_KEY = 'suppliers'

export function useSuppliers(organizationId?: string, category?: string) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, organizationId, category],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      if (category) params.append('category', category)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/suppliers/?${queryString}` : '/api/v1/suppliers/'
      return apiClient.get<SupplierWithTransactions[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useSupplier(supplierId: string, organizationId?: string) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, supplierId, organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/suppliers/${supplierId}?${queryString}` : `/api/v1/suppliers/${supplierId}`
      return apiClient.get<Supplier>(url)
    },
    enabled: !!supplierId && !!organizationId,
    // Handle 404 errors properly
    throwOnError: true,
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (supplier: SupplierCreate) =>
      apiClient.post<Supplier>('/api/v1/suppliers/', supplier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
    },
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: SupplierUpdate }) =>
      apiClient.put<Supplier>(`/api/v1/suppliers/${supplierId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (supplierId: string) =>
      apiClient.delete(`/api/v1/suppliers/${supplierId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY] })
    },
  })
}

export function useSupplierStatement(supplierId: string, organizationId: string, dateFrom?: string, dateTo?: string, showStatement?: boolean) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, supplierId, 'statement', dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ organization_id: organizationId })
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      return apiClient.get<SupplierStatement>(`/api/v1/suppliers/${supplierId}/statement?${params.toString()}`)
    },
    enabled: !!supplierId && !!organizationId && (showStatement !== false),
  })
}
