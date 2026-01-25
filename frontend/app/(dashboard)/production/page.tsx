import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, FileText, FolderOpen } from 'lucide-react'
import Link from 'next/link'

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Management</h1>
          <p className="text-muted-foreground">
            Manage all production-related activities and workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/call-sheets/new">
              <Plus className="mr-2 h-4 w-4" />
              New Call Sheet
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shooting-days/new">
              <Calendar className="mr-2 h-4 w-4" />
              New Shooting Day
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Sheets
            </CardTitle>
            <CardDescription>
              Create and manage daily call sheets for your productions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/call-sheets">View All Call Sheets</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/call-sheets/new">Create New Call Sheet</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Shooting Days
            </CardTitle>
            <CardDescription>
              Schedule and organize your shooting days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/shooting-days">View All Shooting Days</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/shooting-days/new">Create New Shooting Day</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Projects
            </CardTitle>
            <CardDescription>
              Manage your active production projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/projects">View All Projects</Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link href="/projects/new">Create New Project</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common production tasks and workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/scenes">
                Manage Scenes
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/characters">
                Manage Characters
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/inventory/items">
                Equipment Inventory
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/suppliers">
                Production Vendors
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}