import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { Project, ProjectWithClient, ProjectCreate, ProjectUpdate, ProjectStats, ProjectFinancialSummary } from '@/types'

const PROJECTS_KEY = 'projects'
const PROJECT_KEY = 'project'
const PROJECT_STATS_KEY = 'project_stats'
const PROJECT_FINANCIAL_SUMMARY_KEY = 'project_financial_summary'

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

export function useProjectFinancialSummary(projectId: string) {
  return useQuery({
    queryKey: [PROJECT_FINANCIAL_SUMMARY_KEY, projectId],
    queryFn: () => apiClient.get<ProjectFinancialSummary>(`/api/v1/projects/${projectId}/financial-summary`),
    enabled: !!projectId,
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

// =============================================================================
// Budget Approval Hooks
// =============================================================================

export interface BudgetSubmitRequest {
  budget_total_cents: number
  notes?: string
}

export interface BudgetApprovalRequest {
  notes?: string
}

export interface BudgetRejectionRequest {
  reason: string
}

export function useSubmitBudget(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BudgetSubmitRequest) =>
      apiClient.post<ProjectWithClient>(`/api/v1/projects/${projectId}/budget/submit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_KEY, projectId] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
    },
  })
}

export function useApproveBudget(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BudgetApprovalRequest) =>
      apiClient.post<ProjectWithClient>(`/api/v1/projects/${projectId}/budget/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_KEY, projectId] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
      queryClient.invalidateQueries({ queryKey: [PENDING_BUDGET_PROJECTS_KEY, organizationId] })
    },
  })
}


export function useRejectBudget(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BudgetRejectionRequest) =>
      apiClient.post<ProjectWithClient>(`/api/v1/projects/${projectId}/budget/reject`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_KEY, projectId] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
      queryClient.invalidateQueries({ queryKey: [PENDING_BUDGET_PROJECTS_KEY, organizationId] })
    },
  })
}

export interface BudgetIncrementRequest {
  increment_cents: number
  notes?: string
}

export function useRequestBudgetIncrement(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BudgetIncrementRequest) =>
      apiClient.post<ProjectWithClient>(`/api/v1/projects/${projectId}/budget/request-increment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_KEY, projectId] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, organizationId] })
      queryClient.invalidateQueries({ queryKey: [PENDING_BUDGET_PROJECTS_KEY, organizationId] })
    },
  })
}

// =============================================================================
// Pending Budget Projects (Admin Dashboard)
// =============================================================================

const PENDING_BUDGET_PROJECTS_KEY = 'pending_budget_projects'

export function usePendingBudgetProjects(organizationId?: string) {
  return useQuery({
    queryKey: [PENDING_BUDGET_PROJECTS_KEY, organizationId],
    queryFn: () =>
      apiClient.get<ProjectWithClient[]>(`/api/v1/projects/pending-budgets?organization_id=${organizationId}`),
    enabled: !!organizationId,
  })
}

