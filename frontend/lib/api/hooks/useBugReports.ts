import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

const BUG_REPORTS_KEY = 'bug-reports'

export interface BugReport {
  id: string
  organization_id: string
  reporter_profile_id: string
  title: string
  category: string
  description: string
  status: string
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export function usePlatformBugReports() {
  return useQuery({
    queryKey: [BUG_REPORTS_KEY],
    queryFn: () => apiClient.get<BugReport[]>('/api/v1/platform/bug-reports/'),
  })
}

export function useUpdateBugReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string; admin_notes?: string }) =>
      apiClient.patch(`/api/v1/platform/bug-reports/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUG_REPORTS_KEY] })
    },
  })
}
