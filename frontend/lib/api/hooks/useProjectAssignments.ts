import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { CONTACTS_KEY } from './useContacts'

const PROJECT_ASSIGNMENTS_KEY = 'project_assignments'

export interface ProjectAssignment {
  id: string
  project_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface ProjectAssignmentCreatePayload {
  project_id: string
  user_id: string
}

export function useProjectAssignments(projectId?: string) {
  return useQuery({
    queryKey: [PROJECT_ASSIGNMENTS_KEY, projectId],
    queryFn: () => {
      if (!projectId) throw new Error('projectId is required')
      return apiClient.get<ProjectAssignment[]>(
        `/api/v1/project-assignments/?project_id=${projectId}`
      )
    },
    enabled: !!projectId,
  })
}

export function useCreateProjectAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProjectAssignmentCreatePayload) =>
      apiClient.post<ProjectAssignment>('/api/v1/project-assignments/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ASSIGNMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useDeleteProjectAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiClient.delete(`/api/v1/project-assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ASSIGNMENTS_KEY] })
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}
