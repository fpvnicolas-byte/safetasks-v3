import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Scene, SceneCreate, SceneUpdate } from '@/types'

const SCENES_KEY = 'scenes'

export function useScenes(projectId?: string) {
  return useQuery({
    queryKey: [SCENES_KEY, projectId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectId) params.append('project_id', projectId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/scenes/?${queryString}` : '/api/v1/scenes/'
      return apiClient.get<Scene[]>(url)
    },
    enabled: !!projectId,
  })
}

export function useScene(sceneId: string) {
  return useQuery({
    queryKey: [SCENES_KEY, sceneId],
    queryFn: () => apiClient.get<Scene>(`/api/v1/scenes/${sceneId}`),
  })
}

export function useCreateScene() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scene: SceneCreate) =>
      apiClient.post<Scene>('/api/v1/scenes/', scene),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCENES_KEY] })
    },
  })
}

export function useUpdateScene() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sceneId, data }: { sceneId: string; data: SceneUpdate }) =>
      apiClient.put<Scene>(`/api/v1/scenes/${sceneId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCENES_KEY] })
    },
  })
}

export function useDeleteScene() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sceneId: string) =>
      apiClient.delete(`/api/v1/scenes/${sceneId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCENES_KEY] })
    },
  })
}

export function useProjectScenes(projectId: string) {
  return useQuery({
    queryKey: [SCENES_KEY, 'project', projectId],
    queryFn: () => apiClient.get<Scene[]>(`/api/v1/scenes/?project_id=${projectId}`),
    enabled: !!projectId,
  })
}

export function useScenesByInternalExternal(projectId: string, internalExternal: 'internal' | 'external') {
  return useQuery({
    queryKey: [SCENES_KEY, 'internal_external', projectId, internalExternal],
    queryFn: () => apiClient.get<Scene[]>(`/api/v1/scenes/?project_id=${projectId}&internal_external=${internalExternal}`),
    enabled: !!projectId && !!internalExternal,
  })
}

export function useScenesByDayNight(projectId: string, dayNight: 'day' | 'night' | 'dawn' | 'dusk') {
  return useQuery({
    queryKey: [SCENES_KEY, 'day_night', projectId, dayNight],
    queryFn: () => apiClient.get<Scene[]>(`/api/v1/scenes/?project_id=${projectId}&day_night=${dayNight}`),
    enabled: !!projectId && !!dayNight,
  })
}
