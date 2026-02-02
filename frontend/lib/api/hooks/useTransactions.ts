import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  Transaction,
  TransactionWithRelations,
  TransactionCreate,
  TransactionStats,
  TransactionOverviewStats
} from '@/types'

const TRANSACTIONS_KEY = 'transactions'

interface TransactionFilters {
  organizationId?: string
  bank_account_id?: string
  project_id?: string
  type?: 'income' | 'expense'
  category?: string
  limit?: number
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.organizationId) params.append('organization_id', filters.organizationId)
      if (filters.bank_account_id) params.append('bank_account_id', filters.bank_account_id)
      if (filters.project_id) params.append('project_id', filters.project_id)
      if (filters.type) params.append('type', filters.type)
      if (filters.category) params.append('category', filters.category)
      if (filters.limit) params.append('limit', filters.limit.toString())

      const queryString = params.toString()
      const url = queryString ? `/api/v1/transactions/?${queryString}` : '/api/v1/transactions/'
      return apiClient.get<TransactionWithRelations[]>(url)
    },
    enabled: !!filters.organizationId,
  })
}


export function usePendingTransactions(organizationId?: string, limit: number = 20) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, 'pending', organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      params.append('limit', limit.toString())
      return apiClient.get<TransactionWithRelations[]>(`/api/v1/transactions/pending?${params.toString()}`)
    },
    enabled: !!organizationId,
  })
}

export function useTransaction(transactionId: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, transactionId],
    queryFn: () => apiClient.get<TransactionWithRelations>(`/api/v1/transactions/${transactionId}`),
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, transaction }: { organizationId: string; transaction: TransactionCreate }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.post<TransactionWithRelations>(`/api/v1/transactions/?${params.toString()}`, transaction)
    },
    onSuccess: () => {
      // Invalidate transactions, bank accounts, and analytics/dashboard data
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, transactionId }: { organizationId: string; transactionId: string }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.delete<TransactionWithRelations>(`/api/v1/transactions/${transactionId}?${params.toString()}`)
    },
    onSuccess: () => {
      // Invalidate transactions, bank accounts, and analytics/dashboard data
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useMonthlyStats(year: number, month: number, organizationId?: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, 'stats', 'monthly', year, month, organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      params.append('year', year.toString())
      params.append('month', month.toString())
      if (organizationId) params.append('organization_id', organizationId)

      return apiClient.get<TransactionStats>(`/api/v1/transactions/stats/monthly?${params.toString()}`)
    },
    enabled: !!organizationId && !!year && !!month,
  })
}

export function useOverviewStats(organizationId?: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, 'stats', 'overview', organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)

      return apiClient.get<TransactionOverviewStats>(`/api/v1/transactions/stats/overview?${params.toString()}`)
    },
    enabled: !!organizationId,
  })
}

export function useApproveTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, transactionId }: { organizationId: string; transactionId: string }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.patch<TransactionWithRelations>(`/api/v1/transactions/${transactionId}/approve?${params.toString()}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useRejectTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      organizationId,
      transactionId,
      reason
    }: {
      organizationId: string;
      transactionId: string;
      reason: string
    }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.patch<TransactionWithRelations>(
        `/api/v1/transactions/${transactionId}/reject?${params.toString()}`,
        { decision: 'reject', rejection_reason: reason }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] })
    },
  })
}

export function useMarkTransactionPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, transactionId }: { organizationId: string; transactionId: string }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.patch<TransactionWithRelations>(`/api/v1/transactions/${transactionId}/mark-paid?${params.toString()}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
  })
}
