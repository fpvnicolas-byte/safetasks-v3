import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  Stakeholder,
  StakeholderCreate,
  StakeholderUpdate,
  StakeholderWithRateInfo
} from '@/types'

const STAKEHOLDERS_KEY = 'stakeholders'

export function useStakeholders(projectId?: string, activeOnly: boolean = true) {
  return useQuery({
    queryKey: [STAKEHOLDERS_KEY, projectId, activeOnly],
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectId) params.append('project_id', projectId)
      params.append('active_only', String(activeOnly))

      const queryString = params.toString()
      const url = queryString ? `/api/v1/stakeholders/?${queryString}` : '/api/v1/stakeholders/'
      return apiClient.get<Stakeholder[]>(url)
    },
  })
}

export function useStakeholder(stakeholderId: string) {
  return useQuery({
    queryKey: [STAKEHOLDERS_KEY, stakeholderId],
    queryFn: () => apiClient.get<Stakeholder>(`/api/v1/stakeholders/${stakeholderId}`),
    enabled: !!stakeholderId,
  })
}

export function useCreateStakeholder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stakeholder: StakeholderCreate) =>
      apiClient.post<Stakeholder>('/api/v1/stakeholders/', stakeholder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAKEHOLDERS_KEY] })
    },
  })
}

export function useUpdateStakeholder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ stakeholderId, data }: { stakeholderId: string; data: StakeholderUpdate }) =>
      apiClient.put<Stakeholder>(`/api/v1/stakeholders/${stakeholderId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAKEHOLDERS_KEY] })
    },
  })
}

export function useDeleteStakeholder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stakeholderId: string) =>
      apiClient.delete(`/api/v1/stakeholders/${stakeholderId}`),
    onSuccess: () => {
      // Invalidate stakeholders to refresh the list
      queryClient.invalidateQueries({ queryKey: [STAKEHOLDERS_KEY] })
      // Invalidate transactions so the expense is removed from history and budget recalculated
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      // Invalidate project budget as well
      queryClient.invalidateQueries({ queryKey: ['project-budget'] })
    },
  })
}

/**
 * Get stakeholder with rate calculation and payment tracking.
 * Returns suggested amount, total paid, pending amount, and payment status.
 */
export function useStakeholderRateCalculation(stakeholderId: string | undefined) {
  return useQuery({
    queryKey: [STAKEHOLDERS_KEY, stakeholderId, 'rate-calculation'],
    queryFn: () => apiClient.get<StakeholderWithRateInfo>(
      `/api/v1/stakeholders/${stakeholderId}/rate-calculation`
    ),
    enabled: !!stakeholderId,
  })
}

/**
 * Get all stakeholders for a project with rate calculations.
 * Useful for project financial summary.
 */
export function useProjectStakeholdersWithRates(projectId: string | undefined, activeOnly: boolean = true) {
  return useQuery({
    queryKey: [STAKEHOLDERS_KEY, 'project', projectId, 'with-rates', activeOnly],
    queryFn: () => apiClient.get<StakeholderWithRateInfo[]>(
      `/api/v1/stakeholders/project/${projectId}/with-rates?active_only=${activeOnly}`
    ),
    enabled: !!projectId,
  })
}
