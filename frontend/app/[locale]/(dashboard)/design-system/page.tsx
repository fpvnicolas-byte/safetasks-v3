'use client'

import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function DesignSystemPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-display">Design System</h1>
        <p className="text-muted-foreground">
          Core primitives, variants, and patterns for the SafeTasks UI.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Primary actions, secondary actions, and states.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Use semantic badges for status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Text fields and selects.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Production Name</label>
            <Input placeholder="Untitled project" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select defaultValue="active">
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form Pattern</CardTitle>
          <CardDescription>Balanced layouts for dense production data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Call Sheet Name</label>
              <Input placeholder="Day 12 — Unit A" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location Notes</label>
              <Textarea placeholder="Access, parking, staging, and permit notes." rows={5} />
            </div>
          </div>
          <div className="space-y-4 rounded-lg border bg-card/60 p-4 shadow-sm">
            <div className="text-sm font-medium">Actions</div>
            <p className="text-sm text-muted-foreground">
              Group critical actions in a stable sidebar to keep forms scannable.
            </p>
            <div className="flex flex-col gap-2">
              <Button>Save Draft</Button>
              <Button variant="secondary">Preview</Button>
              <Button variant="outline">Export PDF</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table Pattern</CardTitle>
          <CardDescription>Compact table layout for vendor or crew data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Northlight Rentals</TableCell>
                <TableCell>Equipment</TableCell>
                <TableCell>
                  <Badge variant="success">Active</Badge>
                </TableCell>
                <TableCell className="text-right">$24,800</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Foley Works</TableCell>
                <TableCell>Post</TableCell>
                <TableCell>
                  <Badge variant="warning">Pending</Badge>
                </TableCell>
                <TableCell className="text-right">$8,400</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Atlas Transport</TableCell>
                <TableCell>Transport</TableCell>
                <TableCell>
                  <Badge variant="info">Booked</Badge>
                </TableCell>
                <TableCell className="text-right">$11,200</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dialog Pattern</CardTitle>
          <CardDescription>Confirmations and quick edits.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open confirmation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Finalize call sheet?</DialogTitle>
                <DialogDescription>
                  This action locks the document and notifies the team.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Finalize</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>System feedback and states.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertTitle>Sync active</AlertTitle>
            <AlertDescription>
              Google Drive sync is enabled for this workspace.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Sync failed</AlertTitle>
            <AlertDescription>
              Check your service account permissions and try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empty States</CardTitle>
          <CardDescription>Use centered layouts with a clear action.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-6 py-10 text-center">
            <div className="text-sm font-medium">No call sheets yet</div>
            <p className="text-sm text-muted-foreground mt-2">
              Create the first call sheet to keep production aligned.
            </p>
            <Button className="mt-4">Create call sheet</Button>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-6 py-10 text-center">
            <div className="text-sm font-medium">No filters applied</div>
            <p className="text-sm text-muted-foreground mt-2">
              Try filtering by status or date to narrow results.
            </p>
            <Button variant="outline" className="mt-4">Reset filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter Patterns</CardTitle>
          <CardDescription>Compact filters with consistent spacing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input placeholder="Search by name, ID, or tag" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select defaultValue="active">
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Results</label>
              <div className="flex h-9 items-center justify-center rounded-md border bg-muted/40 text-sm font-medium">
                24 results
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Page Header</CardTitle>
          <CardDescription>Standard header with breadcrumbs and actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-card/60 px-6 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Dashboard / Production
            </div>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-2xl font-bold font-display">Call Sheets</div>
                <p className="text-sm text-muted-foreground">
                  Daily production schedules and crew coordination.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Export</Button>
                <Button>Create call sheet</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
