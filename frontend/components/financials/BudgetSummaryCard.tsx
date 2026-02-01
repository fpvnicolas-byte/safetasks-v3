'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useProjectBudget, CategorySummary } from '@/lib/api/hooks/useBudget'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'

interface BudgetSummaryCardProps {
  projectId: string
}

function CategoryProgress({ category }: { category: CategorySummary }) {
  const t = useTranslations('budget.categories')
  const percentSpent = category.estimated_cents > 0
    ? (category.actual_cents / category.estimated_cents) * 100
    : 0

  const getProgressColor = () => {
    if (percentSpent >= 100) return 'bg-red-500'
    if (percentSpent >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{t(category.category)}</span>
        <span className="text-muted-foreground">
          {formatCurrency(category.actual_cents)} / {formatCurrency(category.estimated_cents)}
        </span>
      </div>
      <Progress
        value={Math.min(percentSpent, 100)}
        className="h-2"
        indicatorClassName={getProgressColor()}
      />
    </div>
  )
}

export function BudgetSummaryCard({ projectId }: BudgetSummaryCardProps) {
  const { data: budget, isLoading } = useProjectBudget(projectId)
  const t = useTranslations('budget')

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!budget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('noBudgetLines')}</p>
        </CardContent>
      </Card>
    )
  }

  const percentSpent = budget.total_estimated_cents > 0
    ? (budget.total_actual_cents / budget.total_estimated_cents) * 100
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-lg font-medium">{t('total')}</span>
            <span className={percentSpent >= 100 ? 'text-red-600 font-bold' : ''}>
              {formatCurrency(budget.total_actual_cents)} / {formatCurrency(budget.total_estimated_cents)}
            </span>
          </div>
          <Progress
            value={Math.min(percentSpent, 100)}
            className="h-3"
            indicatorClassName={percentSpent >= 100 ? 'bg-red-500' : percentSpent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}
          />
          <p className="text-sm text-muted-foreground">
            {percentSpent.toFixed(1)}% {t('spent')}
            {budget.total_variance_cents < 0 && (
              <span className="text-red-600 ml-2">
                ({formatCurrency(Math.abs(budget.total_variance_cents))} {t('overBudget')})
              </span>
            )}
          </p>
        </div>

        {budget.by_category.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t('byCategory')}</h4>
            {budget.by_category.map((cat) => (
              <CategoryProgress key={cat.category} category={cat} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
