'use client'

import { useState } from 'react'
import { useClients, useDeleteClient } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Users, Mail, Phone, FileText } from 'lucide-react'
import Link from 'next/link'
import { Client } from '@/types'

export default function ClientsPage() {
  const { organizationId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  // Get clients data
  const { data: allClients, isLoading, error } = useClients(organizationId || '')
  const deleteClient = useDeleteClient()

  // Apply search filter
  const filteredClients = allClients?.filter(client => {
    if (!searchQuery) return true

    const searchLower = searchQuery.toLowerCase()
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.document?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchQuery)
    )
  }) || []

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Are you sure you want to delete client "${clientName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteClient.mutateAsync(clientId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete client: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-destructive">Failed to load clients. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client relationships and contact information
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Clients</CardTitle>
          <CardDescription>
            Find clients by name, email, document, or phone number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, document, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {allClients && allClients.length > 0 ? 'No clients found' : 'No clients yet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allClients && allClients.length > 0
                  ? 'Try adjusting your search'
                  : 'Get started by creating your first client'}
              </p>
              {(!allClients || allClients.length === 0) && (
                <Button asChild>
                  <Link href="/clients/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Client
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {client.is_active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Inactive
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {client.email && (
                    <div className="flex items-center text-muted-foreground">
                      <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.document && (
                    <div className="flex items-center text-muted-foreground">
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{client.document}</span>
                    </div>
                  )}
                  {!client.email && !client.phone && !client.document && (
                    <p className="text-muted-foreground italic">No contact information</p>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/clients/${client.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/clients/${client.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClient(client.id, client.name)}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {allClients && allClients.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredClients.length} of {allClients.length} client{allClients.length !== 1 ? 's' : ''}
              </span>
              <span>
                {allClients.filter(c => c.is_active).length} active • {allClients.filter(c => !c.is_active).length} inactive
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
