'use client'

import { useState } from 'react'
import { useStakeholders } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, Search, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { useDeleteStakeholder } from '@/lib/api/hooks/useStakeholders'
import { toast } from 'sonner'

export default function StakeholdersPage() {
  const { organizationId, isLoading: isLoadingOrg } = useAuth()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: stakeholders, isLoading: isLoadingStakeholders } = useStakeholders(
    selectedProjectId || undefined
  )
  const deleteStakeholder = useDeleteStakeholder()

  const filteredStakeholders = stakeholders?.filter((stakeholder) =>
    stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stakeholder.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return

    try {
      await deleteStakeholder.mutateAsync(id)
      toast.success('Stakeholder deleted successfully')
    } catch (error) {
      toast.error('Failed to delete stakeholder')
      console.error('Delete error:', error)
    }
  }

  const getProjectName = (projectId: string) => {
    return projects?.find((p) => p.id === projectId)?.title || 'Unknown Project'
  }

  if (isLoadingOrg || isLoadingProjects) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stakeholders</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!organizationId) {
    return <div>Error: No organization found. Please contact support.</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stakeholders</h1>
          <p className="text-muted-foreground">
            Manage project team members and collaborators
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Stakeholder
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter stakeholders by project or search by name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {filteredStakeholders?.length || 0} stakeholder(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStakeholders ? (
            <div className="text-center py-8 text-muted-foreground">Loading stakeholders...</div>
          ) : filteredStakeholders && filteredStakeholders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStakeholders.map((stakeholder) => (
                  <TableRow key={stakeholder.id}>
                    <TableCell className="font-medium">{stakeholder.name}</TableCell>
                    <TableCell>{stakeholder.role}</TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${stakeholder.project_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {getProjectName(stakeholder.project_id)}
                      </Link>
                    </TableCell>
                    <TableCell>{stakeholder.email || '-'}</TableCell>
                    <TableCell>{stakeholder.phone || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/stakeholders/${stakeholder.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Add Payment">
                          <Link href={`/financials/transactions/new?project_id=${stakeholder.project_id}&stakeholder_id=${stakeholder.id}`}>
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(stakeholder.id, stakeholder.name)}
                          disabled={deleteStakeholder.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No stakeholders found</p>
              <Button asChild>
                <Link href="/stakeholders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Stakeholder
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
