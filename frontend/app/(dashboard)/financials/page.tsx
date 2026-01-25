'use client'

import { useState } from 'react'
import { useInvoices, useDeleteInvoice } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Plus, FileText, Eye, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { InvoiceWithItems, InvoiceStatus } from '@/types'

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function FinancialsPage() {
  const { organizationId } = useAuth()
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')

  const filters = statusFilter === 'all' ? {} : { status: statusFilter }
  const { data: invoices, isLoading, error } = useInvoices(organizationId || undefined, filters)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financials</h1>
          <p className="text-muted-foreground">
            Track budgets, invoices, and expenses
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/new-invoice">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="bank-accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Status</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice List */}
          {isLoading ? (
            <div>Loading invoices...</div>
          ) : error ? (
            <div>Error loading invoices: {error.message}</div>
          ) : invoices && invoices.length > 0 ? (
            <div className="grid gap-4">
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Invoices Found</CardTitle>
                <CardDescription>
                  {statusFilter === 'all'
                    ? 'Create your first invoice to get started'
                    : `No invoices with status "${statusFilter}"`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Professional invoices help track payments and manage client relationships
                  </p>
                  <Button asChild>
                    <Link href="/financials/new-invoice">
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Invoice
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bank-accounts">
          <Card>
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>Manage your bank accounts and track balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Manage bank accounts to track your organization&apos;s finances
                </p>
                <Button asChild>
                  <Link href="/financials/bank-accounts">
                    <Plus className="mr-2 h-4 w-4" />
                    View Bank Accounts
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Record income and expenses to track cash flow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Track all income and expenses across your bank accounts
                </p>
                <Button asChild>
                  <Link href="/financials/transactions">
                    <Plus className="mr-2 h-4 w-4" />
                    View Transactions
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>Track production costs and expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Expense tracking coming in future updates
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface InvoiceCardProps {
  invoice: InvoiceWithItems
}

function InvoiceCard({ invoice }: InvoiceCardProps) {
  const { organizationId } = useAuth()
  const deleteInvoice = useDeleteInvoice(organizationId || undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const dueDate = new Date(invoice.due_date)
  const issueDate = new Date(invoice.issue_date)
  const isOverdue = invoice.status !== 'paid' && dueDate < new Date()

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete invoice #${invoice.invoice_number}? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteInvoice.mutateAsync(invoice.id)
    } catch (error) {
      console.error('Failed to delete invoice:', error)
      alert('Failed to delete invoice. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200 dark:border-red-800' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              Invoice #{invoice.invoice_number}
            </CardTitle>
            <CardDescription>
              Issued {issueDate.toLocaleDateString()} • Due {dueDate.toLocaleDateString()}
              {isOverdue && (
                <span className="text-red-600 dark:text-red-400 font-medium ml-2">
                  (Overdue)
                </span>
              )}
            </CardDescription>
          </div>
          <Badge className={statusColors[invoice.status]}>
            {invoice.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-muted-foreground">Client</div>
            <div>{invoice.client?.name || 'No client assigned'}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Project</div>
            <div>{invoice.project?.title || 'No project assigned'}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground">Amount</div>
            <div className="text-lg font-bold">
              {formatCurrency(invoice.total_amount_cents)}
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="text-sm">
            <div className="font-medium text-muted-foreground">Notes:</div>
            <div className="mt-1">{invoice.notes}</div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/financials/invoices/${invoice.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/financials/invoices/${invoice.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
