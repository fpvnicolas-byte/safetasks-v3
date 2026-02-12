'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { TrendsData } from '@/types'
import { formatCurrency } from '@/lib/utils/money'
import { TrendingUp, TrendingDown, Lightbulb } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface RevenueChartProps {
  data: TrendsData
}

/**
 * Format a YYYY-MM string into a short human-readable month label.
 * e.g. "2026-01" → "Jan 26"
 */
function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

export function RevenueChart({ data }: RevenueChartProps) {
  const t = useTranslations('dashboard.revenueChart')
  const trends = data.monthly_financial_trends || []
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

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

  // Slice to last 6 months
  const visibleTrends = trends.slice(-6)

  // Get max value for scaling (use absolute values for correct scaling)
  const maxValue = Math.max(
    ...visibleTrends.map(t =>
      Math.max(t.revenue_cents, t.expenses_cents, Math.abs(t.net_profit_cents))
    ),
    1 // avoid division by zero
  )

  // Calculate revenue growth
  const latestRevenue = trends[trends.length - 1]?.revenue_cents || 0
  const previousRevenue = trends[trends.length - 2]?.revenue_cents || 0
  const revenueGrowth = previousRevenue > 0
    ? ((latestRevenue - previousRevenue) / previousRevenue) * 100
    : 0

  const isPositiveGrowth = revenueGrowth >= 0

  // Determine the active trend data (hovered or latest)
  const activeTrend = hoveredIndex !== null ? visibleTrends[hoveredIndex] : visibleTrends[visibleTrends.length - 1]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('lastMonths', { count: visibleTrends.length })}</CardDescription>
        </div>
        <CardAction>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isPositiveGrowth
              ? 'bg-success/15 text-success'
              : 'bg-destructive/15 text-destructive'
            }`}>
            {isPositiveGrowth ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {revenueGrowth > 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="space-y-5">
          {/* Summary row – shows values for hovered or latest month */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-chart-2/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('revenue')}</div>
              <div className="text-sm font-bold text-chart-2">{formatCurrency(activeTrend.revenue_cents)}</div>
            </div>
            <div className="rounded-lg bg-chart-4/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('expenses')}</div>
              <div className="text-sm font-bold text-chart-4">{formatCurrency(activeTrend.expenses_cents)}</div>
            </div>
            <div className="rounded-lg bg-chart-1/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('netProfit')}</div>
              <div className={`text-sm font-bold ${activeTrend.net_profit_cents >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {formatCurrency(activeTrend.net_profit_cents)}
              </div>
            </div>
          </div>

          {/* Vertical grouped bar chart */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="border-b border-border/40 w-full" />
              ))}
            </div>

            {/* Bars container */}
            <div
              className="relative flex items-end gap-1 sm:gap-2"
              style={{ height: '160px' }}
            >
              {visibleTrends.map((trend, index) => {
                const revenueH = (trend.revenue_cents / maxValue) * 100
                const expenseH = (trend.expenses_cents / maxValue) * 100
                const profitH = (Math.abs(trend.net_profit_cents) / maxValue) * 100
                const isHovered = hoveredIndex === index
                const isInactive = hoveredIndex !== null && hoveredIndex !== index

                return (
                  <div
                    key={index}
                    className={`flex-1 flex items-end justify-center gap-[3px] sm:gap-1 h-full cursor-pointer rounded-md transition-all duration-200 ${isHovered ? 'bg-muted/30' : ''
                      } ${isInactive ? 'opacity-40' : 'opacity-100'}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Revenue bar */}
                    <div
                      className="flex-1 max-w-[28px] rounded-t-sm bg-chart-2 transition-all duration-500 ease-out"
                      style={{ height: `${Math.max(revenueH, 4)}%` }}
                      title={`${t('revenue')}: ${formatCurrency(trend.revenue_cents)}`}
                    />
                    {/* Expenses bar */}
                    <div
                      className="flex-1 max-w-[28px] rounded-t-sm bg-chart-4 transition-all duration-500 ease-out"
                      style={{ height: `${Math.max(expenseH, 4)}%` }}
                      title={`${t('expenses')}: ${formatCurrency(trend.expenses_cents)}`}
                    />
                    {/* Net Profit bar */}
                    <div
                      className={`flex-1 max-w-[28px] rounded-t-sm transition-all duration-500 ease-out ${trend.net_profit_cents >= 0 ? 'bg-chart-1' : 'bg-destructive'
                        }`}
                      style={{ height: `${Math.max(profitH, 4)}%` }}
                      title={`${t('netProfit')}: ${formatCurrency(trend.net_profit_cents)}`}
                    />
                  </div>
                )
              })}
            </div>

            {/* X-axis month labels */}
            <div className="flex gap-1 sm:gap-2 mt-2">
              {visibleTrends.map((trend, index) => (
                <div
                  key={index}
                  className={`flex-1 text-center text-[10px] sm:text-xs font-medium transition-colors duration-200 ${hoveredIndex === index ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                >
                  {formatMonth(trend.month)}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 text-xs border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-chart-2" />
              <span className="text-muted-foreground">{t('revenue')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-chart-4" />
              <span className="text-muted-foreground">{t('expenses')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-chart-1" />
              <span className="text-muted-foreground">{t('netProfit')}</span>
            </div>
          </div>

          {/* Key Insights */}
          {data.key_insights && data.key_insights.length > 0 && (
            <div className="border-t border-border/60 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('keyInsights')}</h4>
              <div className="space-y-1.5">
                {data.key_insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-chart-4" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
