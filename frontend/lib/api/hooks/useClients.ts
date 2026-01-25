import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Client, ClientCreate, ClientUpdate } from '@/types'

const CLIENTS_KEY = 'clients'

export function useClients(organizationId?: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, organizationId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/clients/?${queryString}` : '/api/v1/clients/'
      return apiClient.get<Client[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, clientId],
    queryFn: () => apiClient.get<Client>(`/api/v1/clients/${clientId}`),
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (client: ClientCreate) =>
      apiClient.post<Client>('/api/v1/clients/', client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: ClientUpdate }) =>
      apiClient.put<Client>(`/api/v1/clients/${clientId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clientId: string) =>
      apiClient.delete(`/api/v1/clients/${clientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}
