import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import {
    GoogleOAuthConnectResponse,
    GoogleOAuthStatusResponse,
    GoogleOAuthDisconnectResponse,
    DriveUploadSessionRequest,
    DriveUploadSessionResponse,
    DriveUploadCompleteRequest,
    DriveUploadCompleteResponse,
    DriveDownloadUrlResponse,
    ProjectDriveFolderResponse
} from '@/types'

// Keys for React Query cache
export const googleDriveKeys = {
    all: ['googleDrive'] as const,
    status: () => [...googleDriveKeys.all, 'status'] as const,
    projectFolders: (projectId: string) => [...googleDriveKeys.all, 'projectFolders', projectId] as const,
}

// ─── OAuth2 Flow ────────────────────────────────────────────

export function useGoogleDriveStatus() {
    return useQuery({
        queryKey: googleDriveKeys.status(),
        queryFn: () => apiClient.get<GoogleOAuthStatusResponse>('/api/v1/cloud/google/auth/status'),
    })
}

export function useConnectGoogleDrive() {
    return useMutation({
        mutationFn: () => apiClient.get<GoogleOAuthConnectResponse>('/api/v1/cloud/google/auth/connect'),
        onSuccess: (data) => {
            // Redirect to Google authorization URL
            if (data.authorization_url) {
                window.location.href = data.authorization_url
            }
        },
    })
}

export function useCallbackGoogleDrive() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (params: { code: string; state: string }) =>
            apiClient.get<{ message: string }>(
                `/api/v1/cloud/google/auth/callback?code=${params.code}&state=${params.state}`
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: googleDriveKeys.status() })
        },
    })
}

export function useDisconnectGoogleDrive() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => apiClient.delete<GoogleOAuthDisconnectResponse>('/api/v1/cloud/google/auth'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: googleDriveKeys.status() })
        },
    })
}


// ─── Upload ─────────────────────────────────────────────────

export function useCreateDriveUploadSession() {
    return useMutation({
        mutationFn: (data: DriveUploadSessionRequest) =>
            apiClient.post<DriveUploadSessionResponse>('/api/v1/cloud/google/upload/session', data),
    })
}

export function useConfirmDriveUpload() {
    return useMutation({
        mutationFn: (data: DriveUploadCompleteRequest) =>
            apiClient.post<DriveUploadCompleteResponse>('/api/v1/cloud/google/upload/complete', data),
    })
}


// ─── Download ───────────────────────────────────────────────

export function useDriveDownloadUrl(fileReferenceId?: string) {
    return useQuery({
        queryKey: ['driveDownloadUrl', fileReferenceId],
        queryFn: () =>
            apiClient.get<DriveDownloadUrlResponse>(`/api/v1/cloud/google/download/${fileReferenceId}`),
        enabled: !!fileReferenceId,
        staleTime: 5 * 60 * 1000, // cache URL for 5 minutes
    })
}


// ─── Project Folders ────────────────────────────────────────

export function useProjectDriveFolders(projectId?: string) {
    return useQuery({
        queryKey: googleDriveKeys.projectFolders(projectId || ''),
        queryFn: () =>
            apiClient.get<ProjectDriveFolderResponse>(`/api/v1/cloud/projects/${projectId}/folders`),
        enabled: !!projectId,
    })
}
