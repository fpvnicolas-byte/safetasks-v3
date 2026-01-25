import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import {
  GoogleDriveCredentials,
  GoogleDriveCredentialsCreate,
  GoogleDriveCredentialsUpdate,
  SyncFileRequest,
  SyncResult,
  ProjectSyncRequest,
  ProjectSyncResult,
  ProjectDriveFolder,
} from '@/types'

const GOOGLE_DRIVE_KEY = 'google-drive'

/**
 * Hook to get Google Drive authentication status
 *
 * @example
 * const { data: credentials, isLoading } = useGoogleDriveAuth()
 */
export function useGoogleDriveAuth() {
  return useQuery({
    queryKey: [GOOGLE_DRIVE_KEY, 'auth'],
    queryFn: () => apiClient.get<GoogleDriveCredentials>('/api/v1/cloud/google/auth'),
    retry: false, // Don't retry if not configured
  })
}

/**
 * Hook to setup Google Drive authentication
 *
 * @example
 * const setup = useSetupGoogleDrive()
 *
 * const handleSetup = async (serviceAccountJson: object) => {
 *   await setup.mutateAsync({
 *     service_account_key: serviceAccountJson,
 *     auto_sync_enabled: true
 *   })
 * }
 */
export function useSetupGoogleDrive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: GoogleDriveCredentialsCreate) =>
      apiClient.post<GoogleDriveCredentials>('/api/v1/cloud/google/auth', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOOGLE_DRIVE_KEY] })
    },
  })
}

/**
 * Hook to update Google Drive settings
 *
 * @example
 * const update = useUpdateGoogleDrive()
 *
 * await update.mutateAsync({
 *   auto_sync_enabled: false
 * })
 */
export function useUpdateGoogleDrive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: GoogleDriveCredentialsUpdate) =>
      apiClient.put<GoogleDriveCredentials>('/api/v1/cloud/google/auth', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOOGLE_DRIVE_KEY] })
    },
  })
}

/**
 * Hook to remove Google Drive integration
 *
 * @example
 * const remove = useRemoveGoogleDrive()
 *
 * await remove.mutateAsync()
 */
export function useRemoveGoogleDrive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient.delete<{ message: string }>('/api/v1/cloud/google/auth'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOOGLE_DRIVE_KEY] })
    },
  })
}

/**
 * Hook to sync a specific file to Google Drive
 *
 * @example
 * const syncFile = useSyncFile()
 *
 * await syncFile.mutateAsync({
 *   file_id: 'uuid',
 *   project_id: 'uuid',
 *   module: 'scripts'
 * })
 */
export function useSyncFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SyncFileRequest) =>
      apiClient.post<SyncResult>('/api/v1/cloud/sync/file', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOOGLE_DRIVE_KEY] })
    },
  })
}

/**
 * Hook to sync all files for a project
 *
 * @example
 * const syncAll = useSyncProjectFiles()
 *
 * await syncAll.mutateAsync({
 *   projectId: 'uuid',
 *   modules: ['scripts', 'call_sheets']
 * })
 */
export function useSyncProjectFiles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      projectId,
      request,
    }: {
      projectId: string
      request?: ProjectSyncRequest
    }) =>
      apiClient.post<ProjectSyncResult>(
        `/api/v1/cloud/projects/${projectId}/sync-all`,
        request || {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOOGLE_DRIVE_KEY] })
    },
  })
}

/**
 * Hook to get Google Drive folder structure for a project
 *
 * @example
 * const { data: folders } = useGoogleDriveFolders('project-uuid')
 */
export function useGoogleDriveFolders(projectId: string) {
  return useQuery({
    queryKey: [GOOGLE_DRIVE_KEY, 'folders', projectId],
    queryFn: () =>
      apiClient.get<ProjectDriveFolder>(
        `/api/v1/cloud/projects/${projectId}/folders`
      ),
    enabled: !!projectId,
    retry: false,
  })
}

/**
 * Hook to get sync status
 *
 * @example
 * const { data: status } = useSyncStatus()
 */
export function useCloudSyncStatus(projectId?: string, filePath?: string) {
  return useQuery({
    queryKey: [GOOGLE_DRIVE_KEY, 'status', projectId, filePath],
    queryFn: () => {
      const params = new URLSearchParams()
      if (projectId) params.append('project_id', projectId)
      if (filePath) params.append('file_path', filePath)
      return apiClient.get(`/api/v1/cloud/status?${params.toString()}`)
    },
    enabled: !!projectId || !!filePath,
  })
}
