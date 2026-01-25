import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  CallSheet,
  CallSheetCreate,
  CallSheetUpdate,
  CallSheetFormData,
  convertTimeToBackendFormat,
} from '@/types'

const CALL_SHEETS_KEY = 'callSheets'

/**
 * Get all call sheets for an organization
 * Backend route: GET /api/v1/call-sheets/?organization_id={organizationId}&project_id={projectId}
 */
export function useCallSheets(organizationId: string, projectId?: string) {
  return useQuery({
    queryKey: [CALL_SHEETS_KEY, organizationId, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ organization_id: organizationId })
      if (projectId) params.append('project_id', projectId)
      return apiClient.get<CallSheet[]>(`/api/v1/call-sheets/?${params.toString()}`)
    },
    enabled: !!organizationId,
  })
}

/**
 * Get a single call sheet by ID
 * Backend route: GET /api/v1/call-sheets/{callSheetId}
 */
export function useCallSheet(callSheetId: string) {
  return useQuery({
    queryKey: [CALL_SHEETS_KEY, callSheetId],
    queryFn: () => apiClient.get<CallSheet>(`/api/v1/call-sheets/${callSheetId}`),
    enabled: !!callSheetId,
  })
}

/**
 * Create a new call sheet
 * Backend route: POST /api/v1/call-sheets/
 *
 * Note: Backend expects field names:
 * - shooting_day (not shoot_date)
 * - location (not location_name)
 * - weather (not weather_forecast)
 * - crew_call, on_set, lunch_time, wrap_time (Python time → HH:MM:SS strings)
 * - No talent_call_time, breakfast_time, director fields, etc.
 */
export function useCreateCallSheet(projectId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CallSheetFormData) => {
      // Transform form data to backend schema
      const backendData: CallSheetCreate = {
        project_id: projectId,
        shooting_day: data.shooting_day, // ISO date string
        status: data.status,
        location: data.location, // Backend field name
        location_address: data.location_address,
        parking_info: data.parking_info,
        // Convert HH:MM from HTML inputs to HH:MM:SS for backend
        crew_call: data.crew_call ? convertTimeToBackendFormat(data.crew_call) : undefined,
        on_set: data.on_set ? convertTimeToBackendFormat(data.on_set) : undefined,
        lunch_time: data.lunch_time ? convertTimeToBackendFormat(data.lunch_time) : undefined,
        wrap_time: data.wrap_time ? convertTimeToBackendFormat(data.wrap_time) : undefined,
        weather: data.weather, // Backend field name
        notes: data.notes,
        hospital_info: data.hospital_info,
      }

      return apiClient.post<CallSheet>('/api/v1/call-sheets/', backendData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CALL_SHEETS_KEY, organizationId] })
    },
  })
}

/**
 * Update an existing call sheet
 * Backend route: PUT /api/v1/call-sheets/{callSheetId}
 */
export function useUpdateCallSheet(callSheetId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<CallSheetFormData>) => {
      // Transform form data to backend schema
      const backendData: CallSheetUpdate = {}

      if (data.shooting_day) backendData.shooting_day = data.shooting_day
      if (data.status) backendData.status = data.status
      if (data.location !== undefined) backendData.location = data.location
      if (data.location_address !== undefined) backendData.location_address = data.location_address
      if (data.parking_info !== undefined) backendData.parking_info = data.parking_info
      if (data.crew_call !== undefined) backendData.crew_call = convertTimeToBackendFormat(data.crew_call)
      if (data.on_set !== undefined) backendData.on_set = convertTimeToBackendFormat(data.on_set)
      if (data.lunch_time !== undefined) backendData.lunch_time = convertTimeToBackendFormat(data.lunch_time)
      if (data.wrap_time !== undefined) backendData.wrap_time = convertTimeToBackendFormat(data.wrap_time)
      if (data.weather !== undefined) backendData.weather = data.weather
      if (data.notes !== undefined) backendData.notes = data.notes
      if (data.hospital_info !== undefined) backendData.hospital_info = data.hospital_info

      return apiClient.put<CallSheet>(`/api/v1/call-sheets/${callSheetId}`, backendData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CALL_SHEETS_KEY] })
      queryClient.invalidateQueries({ queryKey: [CALL_SHEETS_KEY, callSheetId] })
    },
  })
}

/**
 * Delete a call sheet
 * Backend route: DELETE /api/v1/call-sheets/{callSheetId}
 */
export function useDeleteCallSheet(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (callSheetId: string) =>
      apiClient.delete(`/api/v1/call-sheets/${callSheetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CALL_SHEETS_KEY, organizationId] })
    },
  })
}
