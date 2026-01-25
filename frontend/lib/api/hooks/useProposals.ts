import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  Proposal,
  ProposalCreate,
  ProposalUpdate,
  ProposalApproval,
  ProposalStatus
} from '@/types'

const PROPOSALS_KEY = 'proposals'

export function useProposals(organizationId?: string, status?: ProposalStatus, clientId?: string) {
  return useQuery({
    queryKey: [PROPOSALS_KEY, organizationId, status, clientId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (organizationId) params.append('organization_id', organizationId)
      if (status) params.append('status', status)
      if (clientId) params.append('client_id', clientId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/proposals/?${queryString}` : '/api/v1/proposals/'
      return apiClient.get<Proposal[]>(url)
    },
    enabled: !!organizationId,
  })
}

export function useProposal(proposalId: string) {
  return useQuery({
    queryKey: [PROPOSALS_KEY, proposalId],
    queryFn: () => apiClient.get<Proposal>(`/api/v1/proposals/${proposalId}`),
    enabled: !!proposalId,
  })
}

export function useCreateProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (proposal: ProposalCreate) =>
      apiClient.post<Proposal>('/api/v1/proposals/', proposal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] })
    },
  })
}

export function useUpdateProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: string; data: ProposalUpdate }) =>
      apiClient.put<Proposal>(`/api/v1/proposals/${proposalId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] })
    },
  })
}

export function useDeleteProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (proposalId: string) =>
      apiClient.delete(`/api/v1/proposals/${proposalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] })
    },
  })
}

export function useApproveProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: string; data: ProposalApproval }) =>
      apiClient.post<Proposal>(`/api/v1/proposals/${proposalId}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPOSALS_KEY] })
      // Invalidate projects as approval creates a project
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
