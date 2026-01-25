import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  ShootingDay,
  ShootingDayCreate,
  ShootingDayUpdate,
  ShootingDayFormData,
  convertTimeToBackendFormat,
  ShootingDayWithScenes
} from '@/types'

const SHOOTING_DAYS_KEY = 'shootingDays'

/**
 * Get all shooting days for an organization
 * Backend route: GET /api/v1/shooting-days/?organization_id={organizationId}&project_id={projectId}
 */
export function useShootingDays(organizationId: string, projectId?: string) {
  return useQuery({
    queryKey: [SHOOTING_DAYS_KEY, organizationId, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ organization_id: organizationId })
      if (projectId) params.append('project_id', projectId)
      return apiClient.get<ShootingDay[]>(`/api/v1/shooting-days/?${params.toString()}`)
    },
    enabled: !!organizationId,
  })
}

/**
 * Get a single shooting day by ID
 * Backend route: GET /api/v1/shooting-days/{shootingDayId}
 */
export function useShootingDay(shootingDayId: string) {
  return useQuery({
    queryKey: [SHOOTING_DAYS_KEY, shootingDayId],
    queryFn: () => apiClient.get<ShootingDayWithScenes>(`/api/v1/shooting-days/${shootingDayId}`),
    enabled: !!shootingDayId,
  })
}

/**
 * Create a new shooting day
 * Backend route: POST /api/v1/shooting-days/
 */
export function useCreateShootingDay(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ShootingDayFormData) => {
      // Transform form data to backend schema
      const backendData: ShootingDayCreate = {
        project_id: projectId,
        date: data.date, // ISO date string
        call_time: convertTimeToBackendFormat(data.call_time), // HH:MM:SS
        wrap_time: data.wrap_time ? convertTimeToBackendFormat(data.wrap_time) : undefined, // HH:MM:SS
        location_name: data.location_name,
        location_address: data.location_address,
        weather_forecast: data.weather_forecast,
        notes: data.notes,
      }

      return apiClient.post<ShootingDay>('/api/v1/shooting-days/', backendData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, organizationId] })
    },
  })
}

/**
 * Update an existing shooting day
 * Backend route: PUT /api/v1/shooting-days/{shootingDayId}
 */
export function useUpdateShootingDay(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<ShootingDayFormData>) => {
      // Transform form data to backend schema
      const backendData: ShootingDayUpdate = {}

      if (data.date) backendData.date = data.date
      if (data.call_time) backendData.call_time = convertTimeToBackendFormat(data.call_time)
      if (data.wrap_time !== undefined) backendData.wrap_time = data.wrap_time ? convertTimeToBackendFormat(data.wrap_time) : undefined
      if (data.location_name !== undefined) backendData.location_name = data.location_name
      if (data.location_address !== undefined) backendData.location_address = data.location_address
      if (data.weather_forecast !== undefined) backendData.weather_forecast = data.weather_forecast
      if (data.notes !== undefined) backendData.notes = data.notes

      return apiClient.put<ShootingDay>(`/api/v1/shooting-days/${shootingDayId}`, backendData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
    },
  })
}

/**
 * Delete a shooting day
 * Backend route: DELETE /api/v1/shooting-days/{shootingDayId}
 */
export function useDeleteShootingDay(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shootingDayId: string) =>
      apiClient.delete(`/api/v1/shooting-days/${shootingDayId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, organizationId] })
    },
  })
}

/**
 * Assign scenes to a shooting day (bulk)
 * Backend route: POST /api/v1/shooting-days/{shootingDayId}/assign-scenes
 */
export function useAssignScenesToShootingDay(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sceneIds: string[]) =>
      apiClient.post(`/api/v1/shooting-days/${shootingDayId}/assign-scenes`, sceneIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, organizationId] })
      // Also invalidate scenes list as their shooting_day_id might have changed
      queryClient.invalidateQueries({ queryKey: ['scenes'] })
    },
  })
}
