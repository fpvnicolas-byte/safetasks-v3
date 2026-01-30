'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTransaction, useDeleteTransaction } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Trash2, Receipt, Calendar, Wallet, FolderOpen, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, getCategoryDisplayName, TransactionCategory } from '@/types'
import { useLocale } from 'next-intl'

export default function TransactionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const [transactionId, setTransactionId] = useState<string | null>(null)

  // Resolve the promise in useEffect
  React.useEffect(() => {
    params.then(({ id }) => {
      setTransactionId(id)
    })
  }, [params])

  const { data: transaction, isLoading, error } = useTransaction(transactionId || '')
  const deleteTransaction = useDeleteTransaction()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!transaction) return

    if (!organizationId) {
      alert('Organization not found. Please log in again.')
      return
    }

    const confirmed = confirm(
      `Are you sure you want to delete this transaction?\n\n` +
      `This will ${transaction.type === 'income' ? 'decrease' : 'increase'} the bank account balance by ${formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}.\n\n` +
      `This action cannot be undone.`
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteTransaction.mutateAsync({
        organizationId,
        transactionId: transactionId || ''
      })
      router.push('/financials/transactions')
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete transaction: ${error.message}`)
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction Details</h1>
          <p className="text-muted-foreground">Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction Details</h1>
          <p className="text-destructive">Failed to load transaction. Please try again.</p>
        </div>
        <Button asChild>
          <Link href="/financials/transactions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financials/transactions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Link>
          </Button>
        </div>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? 'Deleting...' : 'Delete Transaction'}
        </Button>
      </div>

      {/* Transaction Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {transaction.type === 'income' ? (
                <ArrowUpCircle className="h-10 w-10 text-green-600" />
              ) : (
                <ArrowDownCircle className="h-10 w-10 text-red-600" />
              )}
              <div>
                <CardTitle className="text-2xl">
                  {transaction.description || 'Untitled Transaction'}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={transaction.type === 'income' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                    {transaction.type}
                  </Badge>
                  <Badge variant="secondary">
                    {getCategoryDisplayName(transaction.category as TransactionCategory)}
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <div className={`text-3xl font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
              {transaction.type === 'income' ? '+' : '-'}
              {formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Transaction Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bank Account */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Account</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transaction.bank_account?.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currency: {transaction.bank_account?.currency}
            </p>
            <p className="text-xs text-muted-foreground">
              Current Balance: {formatCurrency(transaction.bank_account?.balance_cents || 0, transaction.bank_account?.currency || 'BRL')}
            </p>
            <div className="mt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/financials/bank-accounts">
                  View Accounts
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Date */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(transaction.transaction_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Created: {new Date(transaction.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Link (if exists) */}
      {transaction.project && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Linked Project</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{transaction.project.title}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transaction.project.description || 'No description'}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${transaction.project.id}`}>
                  View Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Info */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Information</CardTitle>
          <CardDescription>
            Complete details about this transaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
              <p className="text-sm font-mono mt-1">{transaction.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Organization ID</p>
              <p className="text-sm font-mono mt-1">{transaction.organization_id}</p>
            </div>
          </div>

          {transaction.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm mt-1">{transaction.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-sm mt-1 capitalize">{transaction.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Category</p>
              <p className="text-sm mt-1">{getCategoryDisplayName(transaction.category as TransactionCategory)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount (Cents)</p>
              <p className="text-sm mt-1">{transaction.amount_cents}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount (Formatted)</p>
              <p className="text-sm mt-1">{formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning about deletion */}
      <Alert>
        <Receipt className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Deleting this transaction will reverse its effect on the bank account balance.
          {transaction.type === 'income'
            ? ` The balance will decrease by ${formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}.`
            : ` The balance will increase by ${formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}.`
          }
        </AlertDescription>
      </Alert>
    </div>
  )
}
