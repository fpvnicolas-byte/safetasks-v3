import { ApiError } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

const getBaseUrl = () => {
  // Always return the full backend URL to bypass Next.js rewrites which might be stripping headers
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
}

const API_BASE_URL = getBaseUrl()
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

    logger.debug('API Client - Session check', {
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
        logger.debug('API Client - Refreshing token')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          logger.error('Token refresh error', refreshError)
        } else if (refreshData.session) {
          session = refreshData.session
          logger.debug('API Client - Token refreshed')
        }
      }
    }

    if (error) {
      logger.error('Supabase session error', error)
      throw new Error('Authentication error: ' + error.message)
    }

    if (!session) {
      logger.error('API Client - No session found')
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
        logger.warn('Could not decode token to check role', { error: e })
      }
    }

    logger.debug('API Client - Sending request', {
      endpoint: endpoint,
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    })

    // DEBUGGING: Print critical info to console to diagnose 403 issue
    console.log('[DEBUG] API Client Request:', {
      url: `${this.baseURL}${endpoint}`,
      baseURL: this.baseURL,
      isWindowDefined: typeof window !== 'undefined',
      endpoint,
      hasToken: !!token,
      // DEBUG: Verify headers before sending matches backend expectation
      // const authHeader = token ? `Bearer ${token}` : undefined;
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

      // Parse JSON response safely
      let data: any = {}
      try {
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          // If not JSON, use text as message
          console.error('API Client - Received non-JSON response:', text)
          data = { message: text, detail: text }
        }
      } catch (e) {
        console.error('API Client - Failed to read response body', e)
        data = { message: 'Failed to read response body' }
      }

      // Handle errors
      if (!response.ok) {
        // FastAPI uses 'detail' (singular) for validation errors
        const errorDetail = data.detail || data.details || data.message

        const error: ApiError = {
          message: typeof errorDetail === 'string' ? errorDetail : (data.message || response.statusText),
          statusCode: response.status,
          details: errorDetail,
        }

        // Log full error response for debugging
        if (response.status === 422) {
          console.error('422 Validation Error - Full response:', JSON.stringify(data, null, 2))
          console.error('422 Validation Error - Detail:', JSON.stringify(errorDetail, null, 2))
        }

        // Handle specific status codes
        // Handle specific status codes
        if (response.status === 401) {
          // Redirect to login (will be handled by middleware)
          console.warn('API Client - 401 Unauthorized. NOT redirecting to avoid loop.');
          // window.location.href = '/auth/login'
          error.message = 'Unauthorized - Please refresh or log in again.'
        } else if (response.status === 400) {
          // Bad Request - use the detail message from the backend
          error.message = typeof errorDetail === 'string'
            ? errorDetail
            : 'Bad request - please check your input'
        } else if (response.status === 403) {
          console.error('API Client - 403 Forbidden - Detail:', errorDetail)
          error.message = typeof errorDetail === 'string'
            ? errorDetail
            : 'You do not have permission to perform this action'
        } else if (response.status === 404) {
          error.message = 'Resource not found'
        } else if (response.status === 422) {
          // Provide more helpful validation error message
          if (Array.isArray(errorDetail)) {
            error.message = `Validation error: ${errorDetail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ')}`
          } else if (typeof errorDetail === 'object') {
            error.message = `Validation error: ${JSON.stringify(errorDetail)}`
          }
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

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        logger.error('API Client - Network Error (Failed to fetch)', {
          url: `${this.baseURL}${endpoint}`,
          message: error.message,
          cause: (error as any).cause,
          error: error.toString(),
          stack: error.stack,
        })
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          statusCode: 408,
        } as ApiError
      }

      // Network/CORS errors: fetch rejects with a TypeError (no HTTP status available).
      if (error instanceof TypeError) {
        throw {
          message:
            'Network error: Could not reach the server. Check that the backend is running and the URL is correct.',
          statusCode: 0,
          details: {
            url: `${this.baseURL}${endpoint}`,
            originalMessage: error.message,
          },
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
