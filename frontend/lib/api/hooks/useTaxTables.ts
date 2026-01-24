import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { TaxTable, TaxTableCreate, TaxTableUpdate } from '@/types'

const TAX_TABLES_KEY = 'tax-tables'

export function useTaxTables(organizationId?: string, activeOnly: boolean = true) {
  return useQuery({
    queryKey: [TAX_TABLES_KEY, organizationId, activeOnly],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      params.append('active_only', activeOnly.toString())

      const queryString = params.toString()
      const url = `/api/v1/tax-tables/?${queryString}`
      return apiClient.get<TaxTable[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useTaxTable(taxTableId: string) {
  return useQuery({
    queryKey: [TAX_TABLES_KEY, taxTableId],
    queryFn: () => apiClient.get<TaxTable>(`/api/v1/tax-tables/${taxTableId}`),
    enabled: !!taxTableId,
  })
}

export function useCreateTaxTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taxTable: TaxTableCreate) =>
      apiClient.post<TaxTable>('/api/v1/tax-tables/', taxTable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAX_TABLES_KEY] })
    },
  })
}

export function useUpdateTaxTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taxTableId, data }: { taxTableId: string; data: TaxTableUpdate }) =>
      apiClient.put<TaxTable>(`/api/v1/tax-tables/${taxTableId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAX_TABLES_KEY] })
    },
  })
}

export function useDeleteTaxTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taxTableId: string) =>
      apiClient.delete(`/api/v1/tax-tables/${taxTableId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAX_TABLES_KEY] })
    },
  })
}
