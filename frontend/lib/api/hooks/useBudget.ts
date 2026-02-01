import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export type BudgetCategory =
  | 'crew'
  | 'equipment'
  | 'locations'
  | 'talent'
  | 'transportation'
  | 'catering'
  | 'post_production'
  | 'music_licensing'
  | 'insurance'
  | 'contingency'
  | 'other'

export interface BudgetLine {
  id: string
  project_id: string
  organization_id: string
  category: BudgetCategory
  description: string
  estimated_amount_cents: number
  actual_amount_cents: number
  variance_cents: number
  variance_percentage: number
  stakeholder_id?: string
  supplier_id?: string
  notes?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CategorySummary {
  category: BudgetCategory
  estimated_cents: number
  actual_cents: number
  variance_cents: number
  variance_percentage: number
}

export interface ProjectBudgetSummary {
  project_id: string
  total_estimated_cents: number
  total_actual_cents: number
  total_variance_cents: number
  variance_percentage: number
  by_category: CategorySummary[]
  lines: BudgetLine[]
}

export interface BudgetLineCreate {
  project_id: string
  category: BudgetCategory
  description: string
  estimated_amount_cents: number
  stakeholder_id?: string
  supplier_id?: string
  notes?: string
  sort_order?: number
}

const BUDGET_KEY = 'budget'

export function useProjectBudget(projectId: string) {
  return useQuery({
    queryKey: [BUDGET_KEY, projectId],
    queryFn: () => apiClient.get<ProjectBudgetSummary>(`/api/v1/financial/projects/${projectId}/budget`),
    enabled: !!projectId,
  })
}

export function useCreateBudgetLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Omit<BudgetLineCreate, 'project_id'> }) =>
      apiClient.post<BudgetLine>(`/api/v1/financial/projects/${projectId}/budget-lines`, {
        ...data,
        project_id: projectId,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY, variables.projectId] })
    },
  })
}

export function useUpdateBudgetLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: Partial<BudgetLineCreate> }) =>
      apiClient.put<BudgetLine>(`/api/v1/financial/budget-lines/${lineId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] })
    },
  })
}

export function useDeleteBudgetLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (lineId: string) =>
      apiClient.delete(`/api/v1/financial/budget-lines/${lineId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] })
    },
  })
}
