'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendsData } from '@/types'
import { formatCurrency } from '@/lib/utils/money'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface RevenueChartProps {
  data: TrendsData
}

export function RevenueChart({ data }: RevenueChartProps) {
  const trends = data.monthly_financial_trends || []

  if (trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>No data available</CardDescription>
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
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>Last {trends.length} months</CardDescription>
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
          <div className="space-y-3">
            {trends.slice(-6).map((trend, index) => {
              const revenueHeight = (trend.revenue_cents / maxValue) * 100
              const expenseHeight = (trend.expenses_cents / maxValue) * 100
              const profitHeight = ((trend.revenue_cents - trend.expenses_cents) / maxValue) * 100

              return (
                <div key={index} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{trend.month}</div>
                  <div className="flex gap-2 h-12 items-end">
                    {/* Revenue bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="bg-green-500 rounded-t transition-all"
                        style={{ height: `${revenueHeight}%` }}
                        title={`Revenue: ${formatCurrency(trend.revenue_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 text-green-700">
                        {formatCurrency(trend.revenue_cents)}
                      </div>
                    </div>

                    {/* Expense bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="bg-red-500 rounded-t transition-all"
                        style={{ height: `${expenseHeight}%` }}
                        title={`Expenses: ${formatCurrency(trend.expenses_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 text-red-700">
                        {formatCurrency(trend.expenses_cents)}
                      </div>
                    </div>

                    {/* Profit bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className={`${profitHeight >= 0 ? 'bg-blue-500' : 'bg-orange-500'} rounded-t transition-all`}
                        style={{ height: `${Math.abs(profitHeight)}%` }}
                        title={`Net: ${formatCurrency(trend.net_profit_cents)}`}
                      />
                      <div className="text-xs text-center mt-1 text-blue-700">
                        {formatCurrency(trend.net_profit_cents)}
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
              <span>Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded" />
              <span>Expenses</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-blue-500 rounded" />
              <span>Net Profit</span>
            </div>
          </div>

          {/* Key Insights */}
          {data.key_insights && data.key_insights.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Key Insights</h4>
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
