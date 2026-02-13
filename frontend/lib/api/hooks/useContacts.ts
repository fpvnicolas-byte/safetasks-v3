import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Contact, ContactDetail, ContactFilters } from '@/types'

const CONTACTS_KEY = 'contacts'

interface UseContactsOptions {
  enabled?: boolean
}

export function useContacts(filters?: ContactFilters, options?: UseContactsOptions) {
  return useQuery({
    queryKey: [CONTACTS_KEY, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.category && filters.category !== 'all') params.append('category', filters.category)
      if (filters?.platform_status && filters.platform_status !== 'all') params.append('platform_status', filters.platform_status)
      if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only))

      const queryString = params.toString()
      const url = queryString ? `/api/v1/contacts/?${queryString}` : '/api/v1/contacts/'
      return apiClient.get<Contact[]>(url)
    },
    enabled: options?.enabled ?? true,
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [CONTACTS_KEY, id],
    queryFn: () => apiClient.get<ContactDetail>(`/api/v1/contacts/${id}`),
    enabled: !!id,
  })
}
