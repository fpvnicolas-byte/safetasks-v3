import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { CONTACTS_KEY } from './useContacts'

export type StakeholderStatus = 'requested' | 'confirmed' | 'working' | 'completed' | 'cancelled'

export interface StakeholderStatusUpdate {
  status: StakeholderStatus
  status_notes?: string
  booking_start_date?: string
  booking_end_date?: string
  confirmed_rate_cents?: number
  confirmed_rate_type?: string
}

export function useUpdateStakeholderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ stakeholderId, data }: { stakeholderId: string; data: StakeholderStatusUpdate }) =>
      apiClient.patch(`/api/v1/stakeholders/${stakeholderId}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders'] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useStakeholdersByStatus(projectId: string) {
  return useQuery({
    queryKey: ['stakeholders', 'by-status', projectId],
    queryFn: () => apiClient.get(`/api/v1/stakeholders/project/${projectId}/by-status`),
    enabled: !!projectId,
  })
}
