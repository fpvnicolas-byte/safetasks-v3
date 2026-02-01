import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Project, ProjectWithClient, ProjectCreate, ProjectUpdate, ProjectStats } from '@/types'

const PROJECTS_KEY = 'projects'
const PROJECT_KEY = 'project'
const PROJECT_STATS_KEY = 'project_stats'

export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: [PROJECTS_KEY, organizationId],
    queryFn: () =>
      apiClient.get<ProjectWithClient[]>(`/api/v1/projects/?organization_id=${organizationId}`),
    enabled: !!organizationId,
  })
}

export function useProject(id: string, organizationId?: string) {
  return useQuery({
    queryKey: [PROJECT_KEY, id],
    queryFn: () => apiClient.get<ProjectWithClient>(`/api/v1/projects/${id}`),
    enabled: !!id && !!organizationId,
  })
}

export function useProjectStats(id: string) {
  return useQuery({
    queryKey: [PROJECT_STATS_KEY, id],
    queryFn: () => apiClient.get<ProjectStats>(`/api/v1/projects/${id}/stats`),
    enabled: !!id,
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
      queryClient.invalidateQueries({ queryKey: [PROJECT_KEY, projectId] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
    },
  })
}

export function useDeleteProject(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiClient.delete(`/api/v1/projects/${projectId}?organization_id=${organizationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
      queryClient.removeQueries({ queryKey: [PROJECT_KEY, projectId] })
    },
  })
}
