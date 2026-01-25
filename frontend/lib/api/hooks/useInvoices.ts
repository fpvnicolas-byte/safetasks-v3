import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Invoice, InvoiceWithItems, InvoiceCreate, InvoiceItemCreate } from '@/types'

const INVOICES_KEY = 'invoices'

export function useInvoices(organizationId?: string, filters?: {
  client_id?: string
  project_id?: string
  status?: Invoice['status']
}) {
  return useQuery({
    queryKey: [INVOICES_KEY, organizationId, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      if (filters?.client_id) params.append('client_id', filters.client_id)
      if (filters?.project_id) params.append('project_id', filters.project_id)
      if (filters?.status) params.append('status', filters.status)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/financial/invoices/?${queryString}` : '/api/v1/financial/invoices/'
      return apiClient.get<InvoiceWithItems[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useInvoice(invoiceId: string, organizationId?: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, invoiceId],
    queryFn: () => {
      const url = organizationId
        ? `/api/v1/financial/invoices/${invoiceId}?organization_id=${organizationId}`
        : `/api/v1/financial/invoices/${invoiceId}`
      return apiClient.get<InvoiceWithItems>(url)
    },
    enabled: !!organizationId,
  })
}

export function useCreateInvoice(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invoice: InvoiceCreate) => {
      const url = organizationId
        ? `/api/v1/financial/invoices/?organization_id=${organizationId}`
        : '/api/v1/financial/invoices/'
      return apiClient.post<InvoiceWithItems>(url, invoice)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}

export function useUpdateInvoice(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: Partial<Invoice> }) => {
      const url = organizationId
        ? `/api/v1/financial/invoices/${invoiceId}?organization_id=${organizationId}`
        : `/api/v1/financial/invoices/${invoiceId}`
      return apiClient.put<InvoiceWithItems>(url, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}

export function useDeleteInvoice(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invoiceId: string) => {
      const url = organizationId
        ? `/api/v1/financial/invoices/${invoiceId}?organization_id=${organizationId}`
        : `/api/v1/financial/invoices/${invoiceId}`
      return apiClient.delete(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}

export function useProjectFinancialReport(projectId: string) {
  return useQuery({
    queryKey: ['financial-report', projectId],
    queryFn: () => apiClient.get(`/api/v1/financial/projects/${projectId}/financial-report`),
    enabled: !!projectId,
  })
}

export function useOrganizationFinancialReport(organizationId: string) {
  return useQuery({
    queryKey: ['financial-report', 'org', organizationId],
    queryFn: () => apiClient.get(`/api/v1/financial/organizations/${organizationId}/financial-report`),
    enabled: !!organizationId,
  })
}

export function useAddInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemData: InvoiceItemCreate) =>
      apiClient.post(`/api/v1/financial/invoices/${invoiceId}/items`, itemData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY, invoiceId] })
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}

export function useUpdateInvoiceItem(invoiceId: string, itemId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemData: Partial<InvoiceItemCreate>) =>
      apiClient.put(`/api/v1/financial/invoices/${invoiceId}/items/${itemId}`, itemData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY, invoiceId] })
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}

export function useDeleteInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`/api/v1/financial/invoices/${invoiceId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY, invoiceId] })
      queryClient.invalidateQueries({ queryKey: [INVOICES_KEY] })
    },
  })
}
