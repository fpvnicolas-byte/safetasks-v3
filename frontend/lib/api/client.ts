import { ApiError } from '@/types'
import { createClient } from '@/lib/supabase/client'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const API_TIMEOUT = 30000 // 30 seconds

interface RequestConfig extends RequestInit {
  timeout?: number
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { timeout = API_TIMEOUT, ...fetchConfig } = config

    // Get fresh JWT token from Supabase (automatically refreshes if expired)
    const supabase = createClient()

    // First try to get the session
    const sessionResult = await supabase.auth.getSession()
    let session = sessionResult.data.session
    const error = sessionResult.error

    console.log('🔍 API Client - Session check:', {
      hasSession: !!session,
      sessionError: error,
      endpoint: endpoint
    })

    // If token is expired or about to expire, refresh it
    if (session && session.expires_at) {
      const expiresAt = session.expires_at * 1000 // Convert to milliseconds
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000

      // Refresh if token expires in less than 5 minutes
      if (expiresAt - now < fiveMinutes) {
        console.log('🔄 API Client - Refreshing token...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('Token refresh error:', refreshError)
        } else if (refreshData.session) {
          session = refreshData.session
          console.log('✅ API Client - Token refreshed')
        }
      }
    }

    if (error) {
      console.error('Supabase session error:', error)
      throw new Error('Authentication error: ' + error.message)
    }

    if (!session) {
      console.error('❌ API Client - No session found')
      throw new Error('Not authenticated - please log in again')
    }

    // IMPORTANT: Check if this is an anon token (which won't work for our API)
    const token = session.access_token
    if (token) {
      try {
        // Decode the token to check if it's an anon token
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.role === 'anon') {
          throw new Error('Invalid token: Cannot use anon token for API requests. Please ensure you are logged in with a user account.')
        }
      } catch (e) {
        console.warn('Could not decode token to check role:', e)
      }
    }

    console.log('📤 API Client - Sending request with token:', {
      endpoint: endpoint,
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...fetchConfig,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...fetchConfig.headers,
        },
      })

      clearTimeout(timeoutId)

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T
      }

      // Parse JSON response
      const data = await response.json()

      // Handle errors
      if (!response.ok) {
        const error: ApiError = {
          message: data.message || response.statusText,
          statusCode: response.status,
          details: data.details,
        }

        // Handle specific status codes
        if (response.status === 401) {
          // Redirect to login (will be handled by middleware)
          window.location.href = '/auth/login'
        } else if (response.status === 403) {
          error.message = 'You do not have permission to perform this action'
        } else if (response.status === 404) {
          error.message = 'Resource not found'
        } else if (response.status === 429) {
          error.message = 'Too many requests. Please try again later.'
        } else if (response.status >= 500) {
          error.message = 'Server error. Please try again later.'
        }

        throw error
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          statusCode: 408,
        } as ApiError
      }

      throw error
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
