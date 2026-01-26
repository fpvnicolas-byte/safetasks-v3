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
    queryFn: () => {
      const params = new URLSearchParams()
      params.append('organization_id', '4384a92c-df41-444b-b34d-6c80e7820486')
      
      const queryString = params.toString()
      const url = queryString ? `/api/v1/clients/${clientId}?${queryString}` : `/api/v1/clients/${clientId}`
      return apiClient.get<Client>(url)
    },
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (client: ClientCreate) => {
      // Always include organization_id in the request
      const params = new URLSearchParams()
      if (client.organization_id) {
        params.append('organization_id', client.organization_id)
      }

      const queryString = params.toString()
      const url = queryString ? `/api/v1/clients/?${queryString}` : '/api/v1/clients/'
      
      return apiClient.post<Client>(url, client)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: ClientUpdate }) => {
      const params = new URLSearchParams()
      params.append('organization_id', '4384a92c-df41-444b-b34d-6c80e7820486')
      
      const queryString = params.toString()
      const url = queryString ? `/api/v1/clients/${clientId}?${queryString}` : `/api/v1/clients/${clientId}`
      return apiClient.put<Client>(url, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clientId: string) => {
      const params = new URLSearchParams()
      params.append('organization_id', '4384a92c-df41-444b-b34d-6c80e7820486')
      
      const queryString = params.toString()
      const url = queryString ? `/api/v1/clients/${clientId}?${queryString}` : `/api/v1/clients/${clientId}`
      return apiClient.delete(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] })
    },
  })
}
