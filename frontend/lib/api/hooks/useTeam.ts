import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { CONTACTS_KEY } from './useContacts'

const TEAM_KEY = 'team'

export interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  effective_role: string
  is_master_owner: boolean
  created_at: string
}

export function useTeamMembers(organizationId?: string) {
  return useQuery({
    queryKey: [TEAM_KEY, organizationId],
    queryFn: () => apiClient.get<TeamMember[]>('/api/v1/team/members'),
    enabled: !!organizationId,
  })
}

export function useChangeRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, role_v2 }: { profileId: string; role_v2: string }) =>
      apiClient.patch(`/api/v1/team/members/${profileId}/role`, { role_v2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) =>
      apiClient.delete(`/api/v1/team/members/${profileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAM_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}
