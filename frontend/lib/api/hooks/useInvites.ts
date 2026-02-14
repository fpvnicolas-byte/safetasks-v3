import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { CONTACTS_KEY } from './useContacts'

const INVITES_KEY = 'invites'

export interface InviteOut {
  id: string
  invited_email: string
  role_v2: string
  status: string
  supplier_id: string | null
  invited_by_id: string
  expires_at: string
  created_at: string
}

export interface InviteCreateResponse {
  invite: InviteOut
  invite_link: string
  seat_warning: string | null
}

export interface InviteCreatePayload {
  email: string
  role_v2: string
  supplier_id?: string
}

export function useInvites(organizationId?: string) {
  return useQuery({
    queryKey: [INVITES_KEY, organizationId],
    queryFn: () => apiClient.get<InviteOut[]>('/api/v1/invites/'),
    enabled: !!organizationId,
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteCreatePayload) =>
      apiClient.post<InviteCreateResponse>('/api/v1/invites/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVITES_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiClient.post(`/api/v1/invites/${inviteId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVITES_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useResendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiClient.post<{ invite_link: string }>(`/api/v1/invites/${inviteId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVITES_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ detail: string; organization_id: string; role_v2: string }>(
        '/api/v1/invites/accept',
        { token }
      ),
  })
}
