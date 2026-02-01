import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Project, ProjectWithClient, ProjectCreate, ProjectUpdate } from '@/types'

const PROJECTS_KEY = 'projects'

export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: [PROJECTS_KEY, organizationId],
    queryFn: () =>
      apiClient.get<Project[]>(`/api/v1/projects/?organization_id=${organizationId}`),
    enabled: !!organizationId,
  })
}

export function useProject(projectId: string, organizationId?: string) {
  return useQuery({
    queryKey: [PROJECTS_KEY, projectId],
    queryFn: () => apiClient.get<ProjectWithClient>(`/api/v1/projects/${projectId}?organization_id=${organizationId}`),
    enabled: !!organizationId,
  })
}

export function useCreateProject(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProjectCreate) => {
      if (!organizationId) {
        throw new Error('Missing organization_id for project creation')
      }
      const params = new URLSearchParams()
      params.append('organization_id', organizationId)
      return apiClient.post<Project>(`/api/v1/projects/?${params.toString()}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
    },
  })
}

export function useUpdateProject(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProjectUpdate) =>
      apiClient.put<Project>(`/api/v1/projects/${projectId}?organization_id=${organizationId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, projectId] })
    },
  })
}

export function useDeleteProject(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiClient.delete(`/api/v1/projects/${projectId}?organization_id=${organizationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
  })
}
