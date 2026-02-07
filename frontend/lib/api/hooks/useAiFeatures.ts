import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  AiScriptAnalysisRequest,
  AiAnalysisResponse,
  AiSuggestion,
  AiRecommendation,
  ScriptAnalysis,
  AiBudgetEstimation,
  AiCallSheetSuggestion
} from '@/types'

export function useAiAnalysis(organizationId: string) {
  return useQuery({
    queryKey: ['ai-analysis', organizationId],
    queryFn: async () => {
      const result = await apiClient.get<ScriptAnalysis[]>('/api/v1/ai/analysis/')
      return result
    },
    enabled: !!organizationId
  })
}

export function useAiSuggestions(projectId: string) {
  return useQuery({
    queryKey: ['ai-suggestions', projectId],
    queryFn: async () => {
      const result = await apiClient.get<AiSuggestion[]>(`/api/v1/ai/suggestions/${projectId}`)
      return result
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 30000 // 30 seconds
  })
}

export function useAiRecommendations(projectId: string) {
  return useQuery({
    queryKey: ['ai-recommendations', projectId],
    queryFn: async () => {
      const result = await apiClient.get<AiRecommendation[]>(`/api/v1/ai/recommendations/${projectId}`)
      return result
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 30000 // 30 seconds
  })
}

export function useDeleteAiAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { analysis_id: string; project_id: string }) => {
      const result = await apiClient.delete(`/api/v1/ai/analysis/${params.analysis_id}`)
      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-analysis'] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations', variables.project_id] })
    }
  })
}

export function useAnalyzeScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (analysisRequest: AiScriptAnalysisRequest) => {
      // Use the real, persisted script-analysis endpoint so suggestions/recommendations
      // show up in the tabs (they are created server-side when analysis completes).
      const result = await apiClient.post<AiAnalysisResponse>('/api/v1/ai/script-analysis', analysisRequest, {
        timeout: 120000,
      })
      return result
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ai-analysis'] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations', variables.project_id] })
    }
  })
}

export function useAiBudgetEstimation() {
  return useMutation({
    mutationFn: async (params: { project_id: string; estimation_type: string; script_content: string }) => {
      const result = await apiClient.post<AiBudgetEstimation>('/api/v1/ai/budget-estimation', params, {
        // Budget estimation can take longer than our default API timeout.
        timeout: 120000,
      })
      return result
    }
  })
}

export function useAiCallSheetSuggestions() {
  return useMutation({
    mutationFn: async (params: { project_id: string; suggestion_type: string; script_content: string }) => {
      const result = await apiClient.post<AiCallSheetSuggestion>('/api/v1/ai/call-sheet-suggestions', params, {
        // Calls can include multiple AI steps (analysis + suggestions).
        timeout: 120000,
      })
      return result
    }
  })
}

export function useAiScriptAnalysis() {
  return useMutation({
    mutationFn: async (params: { project_id: string; analysis_type: string; script_content: string }) => {
      const result = await apiClient.post<AiAnalysisResponse>('/api/v1/ai/script-analysis', params, {
        // Script analysis is often the slowest AI endpoint; avoid client-side abort at 30s.
        timeout: 120000,
      })
      return result
    }
  })
}

export function useAiTextAnalysis() {
  return useMutation({
    mutationFn: async (text: string) => {
      const result = await apiClient.post('/api/v1/ai/analyze-text', { text })
      return result
    }
  })
}

export function useAiStatus(requestId: string) {
  return useQuery({
    queryKey: ['ai-status', requestId],
    queryFn: async () => {
      const result = await apiClient.get(`/api/v1/ai/analysis/status/${requestId}`)
      return result
    },
    enabled: !!requestId
  })
}
