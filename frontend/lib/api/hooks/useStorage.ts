import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  FileUploadResponse,
  SignedUrlRequest,
  SignedUrlResponse,
  CloudSyncRequest,
  CloudSyncResponse,
  SyncStatusResponse,
} from '@/types'

const STORAGE_KEY = 'storage'

/**
 * Hook to upload a file to Supabase Storage via backend API
 *
 * @example
 * const upload = useUploadFile()
 *
 * const handleUpload = async (file: File, module: string) => {
 *   await upload.mutateAsync({ file, module })
 * }
 */
export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      module,
      entityId,
    }: {
      file: File
      module: string
      entityId?: string
    }): Promise<FileUploadResponse> => {
      // Get JWT token from Supabase
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        throw new Error('Not authenticated')
      }

      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('module', module)
      if (entityId) {
        formData.append('entity_id', entityId)
      }

      // Upload file
      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${API_BASE_URL}/api/v1/storage/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate any file lists that might be cached
      queryClient.invalidateQueries({ queryKey: [STORAGE_KEY] })
    },
  })
}

/**
 * Hook to delete a file from Supabase Storage
 *
 * @example
 * const deleteFile = useDeleteFile()
 *
 * await deleteFile.mutateAsync({
 *   bucket: 'public-assets',
 *   filePath: 'org-id/kits/photo.jpg'
 * })
 */
export function useDeleteFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bucket,
      filePath,
    }: {
      bucket: string
      filePath: string
    }): Promise<{ message: string; file_path: string }> => {
      // Get JWT token from Supabase
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/storage/${bucket}/${filePath}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Delete failed')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STORAGE_KEY] })
    },
  })
}

/**
 * Hook to generate a signed URL for private files
 *
 * @example
 * const getSignedUrl = useSignedUrl()
 *
 * const url = await getSignedUrl.mutateAsync({
 *   bucket: 'production-files',
 *   file_path: 'org-id/scripts/script.pdf',
 *   expires_in: 3600 // 1 hour
 * })
 */
export function useSignedUrl() {
  return useMutation({
    mutationFn: async (
      request: SignedUrlRequest
    ): Promise<SignedUrlResponse> => {
      // Get JWT token from Supabase
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/storage/sign-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate signed URL')
      }

      return response.json()
    },
  })
}

/**
 * Hook to sync a file to cloud providers (Google Drive, etc.)
 *
 * @example
 * const syncFile = useSyncToCloud()
 *
 * await syncFile.mutateAsync({
 *   file_path: 'org-id/scripts/script.pdf',
 *   providers: ['google_drive']
 * })
 */
export function useSyncToCloud() {
  return useMutation({
    mutationFn: async (
      request: CloudSyncRequest
    ): Promise<CloudSyncResponse> => {
      // Get JWT token from Supabase
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/storage/sync-cloud`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Cloud sync failed')
      }

      return response.json()
    },
  })
}

/**
 * Hook to check sync status of a file
 *
 * @example
 * const checkStatus = useSyncStatus()
 *
 * const status = await checkStatus.mutateAsync('org-id/scripts/script.pdf')
 */
export function useSyncStatus() {
  return useMutation({
    mutationFn: async (filePath: string): Promise<SyncStatusResponse> => {
      // Get JWT token from Supabase
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/storage/sync-status/${encodeURIComponent(filePath)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get sync status')
      }

      return response.json()
    },
  })
}
