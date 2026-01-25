import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  ExecutiveDashboard,
  FinancialMetrics,
  ProductionMetrics,
  InventoryMetrics,
  CloudMetrics
} from '@/types'

const ANALYTICS_KEY = 'analytics'

export function useExecutiveDashboard(monthsBack: number = 12) {
  return useQuery({
    queryKey: [ANALYTICS_KEY, 'executive', monthsBack],
    queryFn: () => {
      const params = new URLSearchParams()
      params.append('months_back', String(monthsBack))
      return apiClient.get<ExecutiveDashboard>(`/api/v1/dashboard/executive?${params.toString()}`)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  })
}

export function useFinancialDashboard() {
  return useQuery({
    queryKey: [ANALYTICS_KEY, 'financial'],
    queryFn: () => apiClient.get<FinancialMetrics>('/api/v1/dashboard/executive/financial'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}

export function useProductionDashboard() {
  return useQuery({
    queryKey: [ANALYTICS_KEY, 'production'],
    queryFn: () => apiClient.get<ProductionMetrics>('/api/v1/dashboard/executive/production'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}

export function useInventoryDashboard() {
  return useQuery({
    queryKey: [ANALYTICS_KEY, 'inventory'],
    queryFn: () => apiClient.get<InventoryMetrics>('/api/v1/dashboard/executive/inventory'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}

export function useCloudDashboard() {
  return useQuery({
    queryKey: [ANALYTICS_KEY, 'cloud'],
    queryFn: () => apiClient.get<CloudMetrics>('/api/v1/dashboard/executive/cloud'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
