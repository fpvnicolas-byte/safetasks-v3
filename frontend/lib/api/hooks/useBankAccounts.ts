import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { BankAccount, BankAccountCreate, BankAccountUpdate, BankAccountTransferCreate, BankAccountTransferResponse } from '@/types'

const BANK_ACCOUNTS_KEY = 'bank-accounts'

export function useBankAccounts(organizationId?: string) {
  return useQuery({
    queryKey: [BANK_ACCOUNTS_KEY, organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/bank-accounts/?${queryString}` : '/api/v1/bank-accounts/'
      return apiClient.get<BankAccount[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useBankAccount(accountId: string) {
  return useQuery({
    queryKey: [BANK_ACCOUNTS_KEY, accountId],
    queryFn: () => apiClient.get<BankAccount>(`/api/v1/bank-accounts/${accountId}`),
  })
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, account }: { organizationId: string; account: BankAccountCreate }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.post<BankAccount>(`/api/v1/bank-accounts/?${params.toString()}`, account)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] })
    },
  })
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, accountId, data }: { organizationId: string; accountId: string; data: BankAccountUpdate }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.put<BankAccount>(`/api/v1/bank-accounts/${accountId}?${params.toString()}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] })
    },
  })
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, accountId }: { organizationId: string; accountId: string }) => {
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.delete(`/api/v1/bank-accounts/${accountId}?${params.toString()}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] })
    },
  })
}

export function useTransferBetweenBankAccounts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (transfer: BankAccountTransferCreate) =>
      apiClient.post<BankAccountTransferResponse>('/api/v1/bank-accounts/transfer', transfer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
