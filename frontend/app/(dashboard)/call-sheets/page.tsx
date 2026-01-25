'use client'

import { useState } from 'react'
import { useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, FileText } from 'lucide-react'
import Link from 'next/link'
import { TableSkeleton } from '@/components/LoadingSkeletons'

export default function CallSheetsPage() {
  const { organizationId, isLoading: isLoadingOrg } = useAuth()
  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')

  if (isLoadingOrg || isLoadingProjects) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Sheets</h1>
          <p className="text-muted-foreground">Manage production call sheets</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your Call Sheets</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasProjects = projects && projects.length > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Sheets</h1>
          <p className="text-muted-foreground">
            Manage production call sheets
          </p>
        </div>
        {hasProjects && (
          <Button asChild>
            <Link href={`/call-sheets/new${selectedProjectId && selectedProjectId !== 'all' ? `?project=${selectedProjectId}` : ''}`}>
              <Plus className="mr-2 h-4 w-4" />
              New Call Sheet
            </Link>
          </Button>
        )}
      </div>

      {hasProjects && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Filter by Project:</label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Call Sheets</CardTitle>
          <CardDescription>
            {hasProjects
              ? 'View and manage call sheets for your projects'
              : 'Create a project first, then add call sheets'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            {hasProjects ? (
              <>
                <p className="text-lg font-medium mb-2">No call sheets yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first call sheet for this project
                </p>
                <Button asChild>
                  <Link href={`/call-sheets/new${selectedProjectId && selectedProjectId !== 'all' ? `?project=${selectedProjectId}` : ''}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Call Sheet
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">No projects found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a project first to start managing call sheets
                </p>
                <Button asChild variant="outline">
                  <Link href="/projects/new">Create Project First</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
