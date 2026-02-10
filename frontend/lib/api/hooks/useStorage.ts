import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  FileUploadResponse,
  SignedUrlRequest,
  SignedUrlResponse,
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

      // Handle Google Drive files
      if (request.bucket === 'google_drive') {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/cloud/google/download/${request.file_path}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Failed to generate download URL')
        }

        const data = await response.json()
        return {
          signed_url: data.download_url,
          expires_in: data.expires_in,
          file_path: request.file_path,
          bucket: request.bucket
        }
      }

      // Handle Standard Storage (Supabase/S3)
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
