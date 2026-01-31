'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TestAuthPage() {
  const [token, setToken] = useState('')
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    async function getToken() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setToken(session.access_token)
        setUserId(session.user.id)
        setEmail(session.user.email || '')
      }
    }
    getToken()
  }, [])

  const copyToken = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const testBackend = async () => {
    const results: Record<string, unknown>[] = []
    const orgId = '4384a92c-df41-444b-b34d-6c80e7820486'

    // Test 1: Projects with auth
    try {
      const res = await fetch(`http://localhost:8000/api/v1/projects/?organization_id=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      results.push({
        test: 'GET /api/v1/projects/',
        status: res.status,
        ok: res.ok,
        data: res.ok ? await res.json() : await res.text()
      })
    } catch (err) {
      results.push({
        test: 'GET /api/v1/projects/',
        error: err instanceof Error ? err.message : String(err)
      })
    }

    // Test 2: Clients with auth
    try {
      const res = await fetch(`http://localhost:8000/api/v1/clients/?organization_id=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      results.push({
        test: 'GET /api/v1/clients/',
        status: res.status,
        ok: res.ok,
        data: res.ok ? await res.json() : await res.text()
      })
    } catch (err) {
      results.push({
        test: 'GET /api/v1/clients/',
        error: err instanceof Error ? err.message : String(err)
      })
    }

    // Test 3: Profile endpoint (will fail - doesn't exist yet)
    try {
      const res = await fetch('http://localhost:8000/api/v1/profiles/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      results.push({
        test: 'GET /api/v1/profiles/me',
        status: res.status,
        ok: res.ok,
        data: res.ok ? await res.json() : await res.text()
      })
    } catch (err) {
      results.push({
        test: 'GET /api/v1/profiles/me',
        error: err instanceof Error ? err.message : String(err)
      })
    }

    setTestResults(results)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔐 Authentication Test Page</h1>

        {!token ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Not Logged In</h2>
            <p className="text-yellow-700">
              Please <a href="/auth/login" className="underline">login</a> first, then come back to this page.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">✅ Authentication Status</h2>
              <div className="space-y-3">
                <div>
                  <strong className="text-gray-700">Email:</strong>
                  <pre className="bg-gray-50 p-2 rounded mt-1 text-sm">{email}</pre>
                </div>
                <div>
                  <strong className="text-gray-700">User ID:</strong>
                  <pre className="bg-gray-50 p-2 rounded mt-1 text-sm font-mono">{userId}</pre>
                  <p className="text-xs text-gray-500 mt-1">
                    ✅ This should match your profile.id: 3454bfa2-aabe-4254-b89d-af29c98548fc
                  </p>
                </div>
              </div>
            </div>

            {/* JWT Token */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🎟️ JWT Access Token</h2>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs break-all">
                {token}
              </div>
              <button
                onClick={copyToken}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                {copied ? '✅ Copied!' : '📋 Copy Token'}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Use this token in curl commands to test the backend API directly.
              </p>
            </div>

            {/* Test Backend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🧪 Test Backend Endpoints</h2>
              <button
                onClick={testBackend}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                Run Backend Tests
              </button>

              {testResults.length > 0 && (
                <div className="mt-6 space-y-4">
                  {testResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded border ${
                        result.ok
                          ? 'bg-green-50 border-green-200'
                          : result.error
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="font-semibold mb-2">
                        {result.ok ? '✅' : '❌'} {String(result.test)}
                      </div>
                      {result.status !== undefined && (
                        <div className="text-sm mb-2">
                          Status: <code className="bg-white px-2 py-1 rounded">{String(result.status)}</code>
                        </div>
                      )}
                      {result.error !== undefined && (
                        <div className="text-sm text-red-700">
                          Error: {String(result.error)}
                        </div>
                      )}
                      {result.data !== undefined && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold">
                            View Response
                          </summary>
                          <pre className="bg-white p-2 rounded mt-2 text-xs overflow-x-auto">
                            {typeof result.data === 'string'
                              ? result.data
                              : JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Curl Commands */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">💻 Manual Testing Commands</h2>
              <p className="text-gray-600 mb-4">
                Copy these commands to test the backend directly from your terminal:
              </p>
              <div className="space-y-3">
                <div>
                  <strong className="text-sm text-gray-700">Test Projects:</strong>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded mt-1 text-xs overflow-x-auto">
{`curl "http://localhost:8000/api/v1/projects/?organization_id=4384a92c-df41-444b-b34d-6c80e7820486" \\
  -H "Authorization: Bearer ${token.substring(0, 50)}..."`}
                  </pre>
                </div>
                <div>
                  <strong className="text-sm text-gray-700">Test Clients:</strong>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded mt-1 text-xs overflow-x-auto">
{`curl "http://localhost:8000/api/v1/clients/?organization_id=4384a92c-df41-444b-b34d-6c80e7820486" \\
  -H "Authorization: Bearer ${token.substring(0, 50)}..."`}
                  </pre>
                </div>
                <div>
                  <strong className="text-sm text-gray-700">Test Profile (will fail - endpoint doesn&apos;t exist):</strong>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded mt-1 text-xs overflow-x-auto">
{`curl "http://localhost:8000/api/v1/profiles/me" \\
  -H "Authorization: Bearer ${token.substring(0, 50)}..."`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
