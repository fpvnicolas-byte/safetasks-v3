'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTransaction, useDeleteTransaction } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Trash2, Receipt, Calendar, Wallet, FolderOpen, ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, getCategoryDisplayName, TransactionCategory } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function TransactionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('financials.pages.transactionDetail')
  const tApprovals = useTranslations('financials.approvals')
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = async () => {
    if (!transaction) return

    if (!organizationId) {
      alert(t('errors.organizationMissing'))
      return
    }

    setIsDeleting(true)
    try {
      await deleteTransaction.mutateAsync({
        organizationId,
        transactionId: transactionId || ''
      })
      router.push('/financials/transactions')
    } catch (err: unknown) {
      const error = err as Error
      alert(t('errors.deleteFailed', { message: error.message }))
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-destructive">{t('error')}</p>
        </div>
        <Button asChild>
          <Link href="/financials/transactions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('actions.back')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={t('actions.delete')}
        description={t('deleteConfirm', {
          direction: transaction?.type === 'income' ? t('balance.decrease') : t('balance.increase'),
          amount: transaction ? formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL') : ''
        })}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financials/transactions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('actions.back')}
            </Link>
          </Button>
        </div>
        <Button
          variant="destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? t('actions.deleting') : t('actions.delete')}
        </Button>
      </div>

      {/* Transaction Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {transaction.type === 'income' ? (
                <ArrowUpCircle className="h-10 w-10 text-success" />
              ) : (
                <ArrowDownCircle className="h-10 w-10 text-destructive" />
              )}
              <div>
                <CardTitle className="text-2xl">
                  {transaction.description || t('untitled')}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant={transaction.type === 'income' ? 'success' : 'destructive'}>
                    {t(`types.${transaction.type}`)}
                  </Badge>
                  <Badge variant="secondary">
                    {getCategoryDisplayName(transaction.category as TransactionCategory)}
                  </Badge>
                  <Badge
                    variant={
                      transaction.payment_status === 'pending'
                        ? 'warning'
                        : transaction.payment_status === 'approved'
                          ? 'info'
                          : transaction.payment_status === 'paid'
                            ? 'success'
                            : transaction.payment_status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                    }
                  >
                    {transaction.payment_status === 'pending' && <Clock className="w-3 h-3" />}
                    {transaction.payment_status === 'pending'
                      ? tApprovals('waitingApproval')
                      : tApprovals(transaction.payment_status)}
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <div className={`text-3xl font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
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
            <CardTitle className="text-sm font-medium">{t('bankAccount.title')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transaction.bank_account?.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('bankAccount.currency', { currency: transaction.bank_account?.currency })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('bankAccount.balance', {
                amount: formatCurrency(transaction.bank_account?.balance_cents || 0, transaction.bank_account?.currency || 'BRL')
              })}
            </p>
            <div className="mt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/financials/bank-accounts">
                  {t('bankAccount.viewAccounts')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Date */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('date.title')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(transaction.transaction_date).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('date.created', {
                date: new Date(transaction.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Link (if exists) */}
      {transaction.project && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('project.title')}</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{transaction.project.title}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transaction.project.description || t('project.noDescription')}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${transaction.project.id}`}>
                  {t('project.view')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('info.title')}</CardTitle>
          <CardDescription>
            {t('info.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.transactionId')}</p>
              <p className="text-sm font-mono mt-1">{transaction.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.organizationId')}</p>
              <p className="text-sm font-mono mt-1">{transaction.organization_id}</p>
            </div>
          </div>

          {transaction.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.descriptionLabel')}</p>
              <p className="text-sm mt-1">{transaction.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.type')}</p>
              <p className="text-sm mt-1 capitalize">{t(`types.${transaction.type}`)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.category')}</p>
              <p className="text-sm mt-1">{getCategoryDisplayName(transaction.category as TransactionCategory)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.amountCents')}</p>
              <p className="text-sm mt-1">{transaction.amount_cents}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('info.amountFormatted')}</p>
              <p className="text-sm mt-1">{formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning about deletion */}
      <Alert>
        <Receipt className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('warning.title')}</strong> {t('warning.description')}{' '}
          {transaction.type === 'income'
            ? t('warning.balanceDecrease', { amount: formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL') })
            : t('warning.balanceIncrease', { amount: formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL') })
          }
        </AlertDescription>
      </Alert>
    </div>
  )
}
