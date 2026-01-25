import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Character, CharacterCreate, CharacterUpdate } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

const CHARACTERS_KEY = 'characters'

export function useCharacters(projectId?: string) {
  const { profile } = useAuth()
  
  return useQuery({
    queryKey: [CHARACTERS_KEY, projectId],
    queryFn: () => {
      if (!projectId) {
        return apiClient.get<Character[]>('/api/v1/characters/')
      }
      
      const url = `/api/v1/characters/?project_id=${encodeURIComponent(projectId)}&organization_id=${encodeURIComponent(profile?.organization_id || '')}`
      return apiClient.get<Character[]>(url)
    },
    enabled: !!projectId && !!profile?.organization_id,
  })
}

export function useCharacter(characterId: string) {
  const { profile } = useAuth()
  
  return useQuery({
    queryKey: [CHARACTERS_KEY, characterId],
    queryFn: () => {
      const url = `/api/v1/characters/${characterId}?organization_id=${encodeURIComponent(profile?.organization_id || '')}`
      return apiClient.get<Character>(url)
    },
    enabled: !!profile?.organization_id,
  })
}

export function useCreateCharacter() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: (character: CharacterCreate) => {
      console.log('🚀 useCreateCharacter - Character data (no org_id):', character)
      console.log('👤 useCreateCharacter - Profile:', profile)
      console.log('🆔 useCreateCharacter - Organization ID (auto-added by backend):', profile?.organization_id)
      console.log('📤 useCreateCharacter - Sending:', character)
      
      // Send organization_id as query parameter (required by backend)
      const url = `/api/v1/characters/?organization_id=${encodeURIComponent(profile?.organization_id || '')}`
      
      return apiClient.post<Character>(url, character)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: ({ characterId, data }: { characterId: string; data: CharacterUpdate }) => {
      console.log('🚀 useUpdateCharacter - Character data (no org_id):', data)
      console.log('👤 useUpdateCharacter - Profile:', profile)
      console.log('🆔 useUpdateCharacter - Organization ID (auto-added by backend):', profile?.organization_id)
      console.log('📤 useUpdateCharacter - Sending:', data)
      
      return apiClient.put<Character>(`/api/v1/characters/${characterId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: (characterId: string) => {
      const url = `/api/v1/characters/${characterId}?organization_id=${encodeURIComponent(profile?.organization_id || '')}`
      return apiClient.delete(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHARACTERS_KEY] })
    },
  })
}

export function useProjectCharacters(projectId: string) {
  const { profile } = useAuth()
  
  return useQuery({
    queryKey: [CHARACTERS_KEY, 'project', projectId],
    queryFn: () => {
      const url = `/api/v1/characters/?project_id=${encodeURIComponent(projectId)}&organization_id=${encodeURIComponent(profile?.organization_id || '')}`
      return apiClient.get<Character[]>(url)
    },
    enabled: !!projectId && !!profile?.organization_id,
  })
}

// Note: Backend doesn't have role_type field, so role-based filtering is not available
// If you need to filter by character type, implement it client-side or add role_type to backend schema
