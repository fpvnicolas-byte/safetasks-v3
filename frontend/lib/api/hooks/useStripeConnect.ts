import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { StripeConnectStatus, PaymentLinkResponse, PaymentStatusResponse } from '@/types'
import { useEffect } from 'react'

const STRIPE_CONNECT_KEY = 'stripe-connect'

export function useStripeConnectStatus() {
  return useQuery({
    queryKey: [STRIPE_CONNECT_KEY, 'status'],
    queryFn: () => apiClient.get<StripeConnectStatus>('/api/v1/stripe-connect/status'),
  })
}

export function useStripeConnectOnboard() {
  return useMutation({
    mutationFn: (redirectUri: string) =>
      apiClient.post<{ authorization_url: string }>('/api/v1/stripe-connect/onboard', {
        redirect_uri: redirectUri,
      }),
  })
}

export function useStripeConnectDisconnect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiClient.delete('/api/v1/stripe-connect/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STRIPE_CONNECT_KEY] })
    },
  })
}

export function useGeneratePaymentLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient.post<PaymentLinkResponse>(`/api/v1/stripe-connect/invoices/${invoiceId}/payment-link`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function usePaymentStatus(invoiceId: string, enabled: boolean = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [STRIPE_CONNECT_KEY, 'payment-status', invoiceId],
    queryFn: () =>
      apiClient.get<PaymentStatusResponse>(`/api/v1/stripe-connect/invoices/${invoiceId}/payment-status`),
    enabled,
    refetchInterval: 30000, // Poll every 30s for active payment links
  })

  useEffect(() => {
    const status = query.data
    if (!status) return

    if (status.invoice_status === 'paid' || status.payment_status === 'paid') {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    }
  }, [query.data?.invoice_status, query.data?.payment_status, queryClient])

  return query
}
