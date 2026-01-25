import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Character, CharacterCreate, CharacterUpdate } from '@/types'

const CHARACTERS_KEY = 'characters'

export function useCharacters(projectId?: string) {
  return useQuery({
    queryKey: [CHARACTERS_KEY, projectId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectId) params.append('project_id', projectId)

      const queryString = params.toString()
      const url = queryString ? `/api/v1/characters/?${queryString}` : '/api/v1/characters/'
      return apiClient.get<Character[]>(url)
    },
    enabled: !!projectId,
  })
}

export function useCharacter(characterId: string) {
  return useQuery({
    queryKey: [CHARACTERS_KEY, characterId],
    queryFn: () => apiClient.get<Character>(`/api/v1/characters/${characterId}`),
  })
}

export function useCreateCharacter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (character: CharacterCreate) =>
      apiClient.post<Character>('/api/v1/characters/', character),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ characterId, data }: { characterId: string; data: CharacterUpdate }) =>
      apiClient.put<Character>(`/api/v1/characters/${characterId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (characterId: string) =>
      apiClient.delete(`/api/v1/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useProjectCharacters(projectId: string) {
  return useQuery({
    queryKey: [CHARACTERS_KEY, 'project', projectId],
    queryFn: () => apiClient.get<Character[]>(`/api/v1/characters/?project_id=${projectId}`),
    enabled: !!projectId,
  })
}

// Note: Backend doesn't have role_type field, so role-based filtering is not available
// If you need to filter by character type, implement it client-side or add role_type to backend schema
