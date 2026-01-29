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

export function useAnalyzeScript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (analysisRequest: AiScriptAnalysisRequest) => {
      const result = await apiClient.post<AiAnalysisResponse>(`/api/v1/ai/projects/${analysisRequest.project_id}/analyze-script`, analysisRequest)
      return result
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ai-analysis', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations', variables.project_id] })
    }
  })
}

export function useAiBudgetEstimation() {
  return useMutation({
    mutationFn: async (params: { project_id: string; estimation_type: string; script_content: string }) => {
      const result = await apiClient.post<AiBudgetEstimation>('/api/v1/ai/budget-estimation', params)
      return result
    }
  })
}

export function useAiCallSheetSuggestions() {
  return useMutation({
    mutationFn: async (params: { project_id: string; suggestion_type: string; script_content: string }) => {
      const result = await apiClient.post<AiCallSheetSuggestion>('/api/v1/ai/call-sheet-suggestions', params)
      return result
    }
  })
}

export function useAiScriptAnalysis() {
  return useMutation({
    mutationFn: async (params: { project_id: string; analysis_type: string; script_content: string }) => {
      const result = await apiClient.post<AiAnalysisResponse>('/api/v1/ai/script-analysis', params)
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
