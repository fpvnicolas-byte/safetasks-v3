'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProjects, useCallSheets, useBankAccounts } from '@/lib/api/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderOpen, FileText, DollarSign, Calendar, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, organizationId } = useAuth()

  // Fetch data
  const { data: projects, isLoading: projectsLoading } = useProjects(organizationId)
  const { data: callSheets, isLoading: callSheetsLoading } = useCallSheets(organizationId || '')
  const { data: bankAccounts, isLoading: bankAccountsLoading } = useBankAccounts(organizationId)

  // Calculate stats
  const stats = useMemo(() => {
    // Active projects (not archived or delivered)
    const activeProjects = projects?.filter(p =>
      p.status !== 'archived' && p.status !== 'delivered'
    ).length || 0

    // Call sheets for today
    const today = new Date().toISOString().split('T')[0]
    const todayCallSheets = callSheets?.filter(cs =>
      cs.shooting_day.startsWith(today)
    ).length || 0

    // Total balance across all bank accounts
    const totalBalanceCents = bankAccounts?.reduce((sum, account) =>
      sum + (account.balance_cents || 0), 0
    ) || 0

    // Convert cents to dollars/reais (assuming BRL or USD)
    const totalBalance = (totalBalanceCents / 100).toFixed(2)

    // Get primary currency from first account or default to BRL
    const currency = bankAccounts?.[0]?.currency || 'BRL'
    const currencySymbol = currency === 'USD' ? '$' :
                          currency === 'EUR' ? '€' :
                          currency === 'GBP' ? '£' :
                          'R$'

    // Upcoming shoots (next 7 days)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const upcomingShots = callSheets?.filter(cs => {
      const shootDate = new Date(cs.shooting_day)
      const todayDate = new Date(today)
      return shootDate > todayDate && shootDate <= nextWeek
    }).length || 0

    return {
      activeProjects,
      todayCallSheets,
      totalBalance: `${currencySymbol}${totalBalance}`,
      upcomingShots,
    }
  }, [projects, callSheets, bankAccounts])

  const isLoading = projectsLoading || callSheetsLoading || bankAccountsLoading

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.activeProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeProjects === 0 ? 'No projects yet' : 'In progress'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Sheets Today</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.todayCallSheets}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.todayCallSheets === 0 ? 'Nothing scheduled' : 'Scheduled today'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.totalBalance}</div>
                <p className="text-xs text-muted-foreground">Across all accounts</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Shoots</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.upcomingShots}</div>
                <p className="text-xs text-muted-foreground">Next 7 days</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Button asChild variant="outline" className="h-auto flex-col gap-2 p-4">
            <Link href="/projects/new">
              <FolderOpen className="h-8 w-8" />
              <div className="text-sm font-medium">Create Project</div>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto flex-col gap-2 p-4">
            <Link href="/call-sheets/new">
              <FileText className="h-8 w-8" />
              <div className="text-sm font-medium">New Call Sheet</div>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-auto flex-col gap-2 p-4">
            <Link href="/clients/new">
              <Calendar className="h-8 w-8" />
              <div className="text-sm font-medium">Add Client</div>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest updates and changes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </CardContent>
      </Card>
    </div>
  )
}
