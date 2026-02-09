'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DollarSign } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSupplierStatement } from '@/lib/api/hooks'
import { formatCurrency } from '@/types'
import type { ContactDetail } from '@/types'

interface ContactFinancialsTabProps {
  contact: ContactDetail
  organizationId: string
}

export function ContactFinancialsTab({ contact, organizationId }: ContactFinancialsTabProps) {
  const t = useTranslations('contacts.detail')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showStatement, setShowStatement] = useState(false)

  const { data: statement, isLoading: isLoadingStatement } = useSupplierStatement(
    contact.id,
    organizationId,
    showStatement ? (dateFrom || undefined) : undefined,
    showStatement ? (dateTo || undefined) : undefined,
    showStatement,
  )

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('financialStatement')}
          </CardTitle>
          <CardDescription>{t('financialStatementDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date_from">{t('fromDate')}</Label>
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_to">{t('toDate')}</Label>
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setShowStatement(true)}
                className="w-full"
                disabled={!dateFrom || !dateTo}
              >
                {t('generateStatement')}
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('totalSpent')}</div>
              <div className="text-2xl font-bold">{formatCurrency(contact.total_spent_cents)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t('projectCount')}</div>
              <div className="text-2xl font-bold">{contact.project_count}</div>
            </div>
          </div>

          {showStatement && isLoadingStatement && (
            <div className="text-sm text-muted-foreground">{t('loadingStatement')}</div>
          )}

          {showStatement && statement && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('totalTransactions')}</div>
                  <div className="text-2xl font-bold">{statement.total_transactions}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('periodTotal')}</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(statement.total_amount_cents, statement.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('period')}</div>
                  <div className="text-sm">
                    {statement.statement_period.from || 'All time'} - {statement.statement_period.to || 'Present'}
                  </div>
                </div>
              </div>

              {statement.project_breakdown && statement.project_breakdown.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">{t('byProject')}</h4>
                  <div className="space-y-2">
                    {statement.project_breakdown.map((project, index) => {
                      const rec = project as Record<string, unknown>
                      return (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{(rec.project_name as string) || 'Unknown'}</span>
                          <span className="font-medium">
                            {formatCurrency((rec.total_cents as number) || 0, statement.currency)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
