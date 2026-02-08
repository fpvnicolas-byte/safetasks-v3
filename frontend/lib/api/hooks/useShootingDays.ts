import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  ShootingDay,
  ShootingDayCreate,
  ShootingDayUpdate,
  ShootingDayFormData,
  convertTimeToBackendFormat,
  ShootingDayWithScenes,
  ShootingDayDetail,
  CrewAssignment,
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
 * Get a single shooting day by ID with scenes and crew
 * Backend route: GET /api/v1/shooting-days/{shootingDayId}
 */
export function useShootingDay(shootingDayId: string) {
  return useQuery({
    queryKey: [SHOOTING_DAYS_KEY, shootingDayId],
    queryFn: () => apiClient.get<ShootingDayDetail>(`/api/v1/shooting-days/${shootingDayId}`),
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
        status: data.status,
        call_time: convertTimeToBackendFormat(data.call_time), // HH:MM:SS
        on_set: data.on_set ? convertTimeToBackendFormat(data.on_set) : undefined,
        lunch_time: data.lunch_time ? convertTimeToBackendFormat(data.lunch_time) : undefined,
        wrap_time: data.wrap_time ? convertTimeToBackendFormat(data.wrap_time) : undefined, // HH:MM:SS
        location_name: data.location_name,
        location_address: data.location_address,
        weather_forecast: data.weather_forecast,
        notes: data.notes,
        parking_info: data.parking_info,
        hospital_info: data.hospital_info,
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
      if (data.status !== undefined) backendData.status = data.status
      if (data.call_time) backendData.call_time = convertTimeToBackendFormat(data.call_time)
      if (data.on_set !== undefined) backendData.on_set = data.on_set ? convertTimeToBackendFormat(data.on_set) : undefined
      if (data.lunch_time !== undefined) backendData.lunch_time = data.lunch_time ? convertTimeToBackendFormat(data.lunch_time) : undefined
      if (data.wrap_time !== undefined) backendData.wrap_time = data.wrap_time ? convertTimeToBackendFormat(data.wrap_time) : undefined
      if (data.location_name !== undefined) backendData.location_name = data.location_name
      if (data.location_address !== undefined) backendData.location_address = data.location_address
      if (data.weather_forecast !== undefined) backendData.weather_forecast = data.weather_forecast
      if (data.notes !== undefined) backendData.notes = data.notes
      if (data.parking_info !== undefined) backendData.parking_info = data.parking_info
      if (data.hospital_info !== undefined) backendData.hospital_info = data.hospital_info

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

/**
 * Unassign scenes from a shooting day (bulk)
 * Backend route: POST /api/v1/shooting-days/{shootingDayId}/unassign-scenes
 */
export function useUnassignScenes(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sceneIds: string[]) =>
      apiClient.post(`/api/v1/shooting-days/${shootingDayId}/unassign-scenes`, { scene_ids: sceneIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, organizationId] })
      queryClient.invalidateQueries({ queryKey: ['scenes'] })
    },
  })
}

/**
 * Get crew members for a shooting day
 * Backend route: GET /api/v1/shooting-days/{shootingDayId}/crew
 */
export function useShootingDayCrew(shootingDayId: string) {
  return useQuery({
    queryKey: [SHOOTING_DAYS_KEY, shootingDayId, 'crew'],
    queryFn: () => apiClient.get<CrewAssignment[]>(`/api/v1/shooting-days/${shootingDayId}/crew`),
    enabled: !!shootingDayId,
  })
}

/**
 * Add a crew member to a shooting day
 * Backend route: POST /api/v1/shooting-days/{shootingDayId}/crew
 */
export function useAddCrewMember(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { profile_id: string; production_function: string }) =>
      apiClient.post<CrewAssignment>(`/api/v1/shooting-days/${shootingDayId}/crew`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId, 'crew'] })
    },
  })
}

/**
 * Update a crew member's production function
 * Backend route: PUT /api/v1/shooting-days/{shootingDayId}/crew/{assignmentId}
 */
export function useUpdateCrewMember(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assignmentId, production_function }: { assignmentId: string; production_function: string }) =>
      apiClient.put<CrewAssignment>(
        `/api/v1/shooting-days/${shootingDayId}/crew/${assignmentId}`,
        { production_function }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId, 'crew'] })
    },
  })
}

/**
 * Remove a crew member from a shooting day
 * Backend route: DELETE /api/v1/shooting-days/{shootingDayId}/crew/{assignmentId}
 */
export function useRemoveCrewMember(shootingDayId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiClient.delete(`/api/v1/shooting-days/${shootingDayId}/crew/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId] })
      queryClient.invalidateQueries({ queryKey: [SHOOTING_DAYS_KEY, shootingDayId, 'crew'] })
    },
  })
}
