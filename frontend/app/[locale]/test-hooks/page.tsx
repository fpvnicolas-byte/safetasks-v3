'use client'

import React, { useState } from 'react'

export default function TestHooksPage() {
  const [results, setResults] = useState<Record<string, string>>({})

  const API_BASE = '/api/v1'
  const ORGANIZATION_ID = '4384a92c-df41-444b-b34d-6c80e7820486'
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNDU0YmZhMi1hYWJlLTQyNTQtYjg5ZC1hZjI5Yzk4NTQ4ZmMiLCJlbWFpbCI6Im5pY29sYXNAZGV2LmNvbSIsIm9yZ2FuaXphdGlvbl9pZCI6IjQzODRhOTJjLWRmNDEtNDQ0Yi1iMzRkLTZjODBlNzgyMDQ4NiIsImV4cCI6MTc2OTM5NzU5Nn0.5Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2'

  const getHeaders = () => ({
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  })

  const showResult = (testId: string, message: string, type: 'success' | 'error' | 'loading' = 'loading') => {
    const statusColor =
      type === 'success'
        ? 'var(--success)'
        : type === 'error'
          ? 'var(--destructive)'
          : 'var(--warning)'

    setResults(prev => ({
      ...prev,
      [testId]: `<span style="color: ${statusColor}">${message}</span>`
    }))
  }

  const panelStyle: React.CSSProperties = {
    margin: '20px 0',
    padding: '20px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--card)',
    color: 'var(--card-foreground)',
  }

  const testGetAllClients = async () => {
    showResult('test1', 'Testing GET /clients/...', 'loading')
    try {
      const response = await fetch(`${API_BASE}/clients/?organization_id=${ORGANIZATION_ID}`, {
        method: 'GET',
        headers: getHeaders()
      })
      
      if (response.ok) {
        const data = await response.json()
        showResult('test1', `✅ Success! Found ${data.length} clients`, 'success')
        console.log('All clients:', data)
      } else {
        showResult('test1', `❌ Error: ${response.status} ${response.statusText}`, 'error')
      }
    } catch (error) {
      showResult('test1', `❌ Network error: ${error}`, 'error')
    }
  }

  const testGetSingleClient = async () => {
    showResult('test2', 'Testing GET /clients/{id}...', 'loading')
    try {
      const clientId = 'e8264cf3-1016-49e0-89b7-999a9523bbf7'
      const response = await fetch(`${API_BASE}/clients/${clientId}?organization_id=${ORGANIZATION_ID}`, {
        method: 'GET',
        headers: getHeaders()
      })
      
      if (response.ok) {
        const data = await response.json()
        showResult('test2', `✅ Success! Client: ${data.name}`, 'success')
        console.log('Single client:', data)
      } else {
        showResult('test2', `❌ Error: ${response.status} ${response.statusText}`, 'error')
      }
    } catch (error) {
      showResult('test2', `❌ Network error: ${error}`, 'error')
    }
  }

  const testCreateClient = async () => {
    showResult('test3', 'Testing POST /clients/...', 'loading')
    try {
      const newClient = {
        name: 'Test Client Created via API',
        email: 'test-api@example.com',
        organization_id: ORGANIZATION_ID
      }

      const response = await fetch(`${API_BASE}/clients/?organization_id=${ORGANIZATION_ID}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newClient)
      })
      
      if (response.ok) {
        const data = await response.json()
        showResult('test3', `✅ Success! Created client: ${data.name} (ID: ${data.id})`, 'success')
        console.log('Created client:', data)
      } else {
        const errorData = await response.json()
        showResult('test3', `❌ Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`, 'error')
      }
    } catch (error) {
      showResult('test3', `❌ Network error: ${error}`, 'error')
    }
  }

  const testUpdateClient = async () => {
    showResult('test4', 'Testing PUT /clients/{id}...', 'loading')
    try {
      const clientId = 'e8264cf3-1016-49e0-89b7-999a9523bbf7'
      const updateData = {
        name: 'Updated Test Client',
        email: 'updated-test@example.com'
      }

      const response = await fetch(`${API_BASE}/clients/${clientId}?organization_id=${ORGANIZATION_ID}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData)
      })
      
      if (response.ok) {
        const data = await response.json()
        showResult('test4', `✅ Success! Updated client: ${data.name}`, 'success')
        console.log('Updated client:', data)
      } else {
        const errorData = await response.json()
        showResult('test4', `❌ Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`, 'error')
      }
    } catch (error) {
      showResult('test4', `❌ Network error: ${error}`, 'error')
    }
  }

  const testDeleteClient = async () => {
    showResult('test5', 'Testing DELETE /clients/{id}...', 'loading')
    try {
      const clientId = 'e8264cf3-1016-49e0-89b7-999a9523bbf7'

      const response = await fetch(`${API_BASE}/clients/${clientId}?organization_id=${ORGANIZATION_ID}`, {
        method: 'DELETE',
        headers: getHeaders()
      })
      
      if (response.ok) {
        showResult('test5', '✅ Success! Deleted client', 'success')
        console.log('Client deleted successfully')
      } else {
        const errorData = await response.json()
        showResult('test5', `❌ Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`, 'error')
      }
    } catch (error) {
      showResult('test5', `❌ Network error: ${error}`, 'error')
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', margin: '20px', color: 'var(--foreground)' }}>
      <h1>SafeTasks V3 Hook Test Page</h1>
      
      <div style={panelStyle}>
        <h2>Test 1: Get All Clients</h2>
        <button onClick={testGetAllClients}>Test Get All Clients</button>
        <div dangerouslySetInnerHTML={{ __html: results.test1 || '' }} />
      </div>

      <div style={panelStyle}>
        <h2>Test 2: Get Single Client</h2>
        <button onClick={testGetSingleClient}>Test Get Single Client</button>
        <div dangerouslySetInnerHTML={{ __html: results.test2 || '' }} />
      </div>

      <div style={panelStyle}>
        <h2>Test 3: Create Client</h2>
        <button onClick={testCreateClient}>Test Create Client</button>
        <div dangerouslySetInnerHTML={{ __html: results.test3 || '' }} />
      </div>

      <div style={panelStyle}>
        <h2>Test 4: Update Client</h2>
        <button onClick={testUpdateClient}>Test Update Client</button>
        <div dangerouslySetInnerHTML={{ __html: results.test4 || '' }} />
      </div>

      <div style={panelStyle}>
        <h2>Test 5: Delete Client</h2>
        <button onClick={testDeleteClient}>Test Delete Client</button>
        <div dangerouslySetInnerHTML={{ __html: results.test5 || '' }} />
      </div>
    </div>
  )
}
