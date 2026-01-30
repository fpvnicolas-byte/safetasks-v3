'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendsData } from '@/types'
import { formatCurrency } from '@/lib/utils/money'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface RevenueChartProps {
  data: TrendsData
}

export function RevenueChart({ data }: RevenueChartProps) {
  const t = useTranslations('dashboard.revenueChart')
  const trends = data.monthly_financial_trends || []

  if (trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('noData')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Get max value for scaling
  const maxValue = Math.max(...trends.map(t =>
    Math.max(t.revenue_cents, t.expenses_cents)
  ))

  // Calculate revenue growth
  const latestRevenue = trends[trends.length - 1]?.revenue_cents || 0
  const previousRevenue = trends[trends.length - 2]?.revenue_cents || 0
  const revenueGrowth = previousRevenue > 0
    ? ((latestRevenue - previousRevenue) / previousRevenue) * 100
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('lastMonths', { count: trends.length })}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {revenueGrowth >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revenueGrowth > 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Simple bar chart visualization */}
          <div className="space-y-4">
            {trends.slice(-6).map((trend, index) => {
              const revenueHeight = (trend.revenue_cents / maxValue) * 100
              const expenseHeight = (trend.expenses_cents / maxValue) * 100
              const profitHeight = ((trend.revenue_cents - trend.expenses_cents) / maxValue) * 100

              return (
                <div key={index} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{trend.month}</div>
                  <div className="grid grid-cols-3 gap-1 h-16 sm:h-20 items-end">
                    {/* Revenue bar */}
                    <div className="flex flex-col justify-end">
                      <div
                        className="bg-green-500 rounded-t transition-all"
                        style={{ height: `${Math.max(revenueHeight, 8)}%` }}
                        title={`Revenue: ${formatCurrency(trend.revenue_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 text-green-700 truncate">
                        {formatCurrency(trend.revenue_cents)}
                      </div>
                    </div>

                    {/* Expense bar */}
                    <div className="flex flex-col justify-end">
                      <div
                        className="bg-red-500 rounded-t transition-all"
                        style={{ height: `${Math.max(expenseHeight, 8)}%` }}
                        title={`Expenses: ${formatCurrency(trend.expenses_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 text-red-700 truncate">
                        {formatCurrency(trend.expenses_cents)}
                      </div>
                    </div>

                    {/* Profit bar */}
                    <div className="flex flex-col justify-end">
                      <div
                        className={`${profitHeight >= 0 ? 'bg-blue-500' : 'bg-orange-500'} rounded-t transition-all`}
                        style={{ height: `${Math.max(Math.abs(profitHeight), 8)}%` }}
                        title={`Net: ${formatCurrency(trend.net_profit_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 truncate">
                        <span className={profitHeight >= 0 ? 'text-blue-700' : 'text-orange-700'}>
                          {formatCurrency(trend.net_profit_cents)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-6 text-sm border-t pt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-green-500 rounded" />
              <span>{t('revenue')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded" />
              <span>{t('expenses')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-blue-500 rounded" />
              <span>{t('netProfit')}</span>
            </div>
          </div>

          {/* Key Insights */}
          {data.key_insights && data.key_insights.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">{t('keyInsights')}</h4>
              <ul className="space-y-1">
                {data.key_insights.map((insight, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
