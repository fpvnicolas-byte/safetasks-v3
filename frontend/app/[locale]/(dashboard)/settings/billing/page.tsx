'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, CreditCard, TrendingUp, Zap, Users, FolderOpen, FileText, HardDrive, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

interface UsageData {
  organization_id: string
  plan_id: string | null
  plan_name?: string | null
  plan?: {
    id: string
    name: string
    billing_interval: string | null
    stripe_price_id: string | null
    entitlements?: {
      max_projects: number | null
      max_clients: number | null
      max_proposals: number | null
      max_users: number | null
      max_storage_bytes: number | null
      ai_credits: number | null
    }
  }
  subscription?: {
    id: string
    status: string
    cancel_at_period_end: boolean
    canceled_at: string | null
    cancel_at: string | null
    current_period_start: string | null
    current_period_end: string | null
    trial_start: string | null
    trial_end: string | null
    price_id: string | null
    plan_id: string | null
    latest_invoice: string | null
  }
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  billing_status: string
  trial_ends_at: string | null
  access_ends_at?: string | null
  days_until_access_end?: number | null
  usage: {
    projects: number
    clients: number
    proposals: number
    users: number
    storage_bytes: number
    ai_credits: number
  }
  limits: {
    projects: number | null
    clients: number | null
    proposals: number | null
    users: number | null
    storage_bytes: number | null
    ai_credits: number | null
  }
}

const PLAN_NAME_FALLBACKS: Record<string, string> = {
  pro_trial: 'Pro Trial',
  starter: 'Starter',
  professional: 'Professional',
  professional_annual: 'Professional Annual',
  enterprise: 'Enterprise',
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatTrialTimeRemaining = (trialEndsAt: string, locale: string): string | null => {
  const now = Date.now()
  const endsAt = new Date(trialEndsAt).getTime()
  const diff = endsAt - now

  if (diff <= 0) {
    return null
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days >= 1) {
    return rtf.format(days, 'day')
  }

  const hours = Math.ceil(diff / (1000 * 60 * 60))
  return rtf.format(hours, 'hour')
}

const formatDaysToExpiry = (days: number, locale: string): string => {
  if (days <= 0) return '0'
  try {
    return new Intl.NumberFormat(locale).format(days)
  } catch {
    return String(days)
  }
}

const BillingHistory = dynamic(
  () => import('@/components/billing/BillingHistory').then((mod) => ({ default: mod.BillingHistory })),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    ),
    ssr: false,
  }
)

export default function BillingPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const t = useTranslations('settings')
  const translateOrFallback = (key: string, fallback: string) => {
    const translated = t(key)
    return translated === key ? fallback : translated
  }
  const getPlanLabel = (planKey?: string) => {
    if (!planKey) return ''
    const fallback = PLAN_NAME_FALLBACKS[planKey] ?? planKey
    return translateOrFallback(`billingPage.planNames.${planKey}`, fallback)
  }
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUsage = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.get<UsageData>('/api/v1/billing/usage')
      setUsageData(data)
    } catch (error) {
      console.error('Failed to load usage:', error)
      toast.error(t('billingPage.messages.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    const checkPaymentStatus = async () => {
      const success = searchParams.get('success')
      const canceled = searchParams.get('canceled')

      // InfinityPay Params
      const transactionNsu = searchParams.get('transaction_nsu')
      const orderNsu = searchParams.get('order_nsu')
      const invoiceSlug = searchParams.get('slug') // They call it 'slug' in params
      const receiptUrl = searchParams.get('receipt_url')

      if (transactionNsu && orderNsu && invoiceSlug) {
        const toastId = toast.loading(t('billingPage.messages.verifyingPayment'))
        try {
          await apiClient.post('/api/v1/billing/verify', {
            transaction_nsu: transactionNsu,
            order_nsu: orderNsu,
            invoice_slug: invoiceSlug,
            receipt_url: receiptUrl,
          })
          toast.success(t('billingPage.messages.paymentVerified'), { id: toastId })
          // Remove params to clean URL
          const newUrl = window.location.pathname
          window.history.replaceState({}, '', newUrl)
          // Reload usage to reflect new plan
          await loadUsage()
        } catch (error) {
          console.error('Payment verification failed:', error)
          toast.error(t('billingPage.messages.verificationFailed'), { id: toastId })
        }
        return
      }

      if (success === 'true') {
        toast.success(t('billingPage.messages.success'))
      } else if (canceled === 'true') {
        toast.info(t('billingPage.messages.canceled'))
      }
    }

    void checkPaymentStatus()
  }, [searchParams, t, loadUsage])

  useEffect(() => {
    if (organizationId) {
      void loadUsage()
    }
  }, [organizationId, loadUsage])

  const formatPlanDate = (value: string | null | undefined): string | null => {
    if (!value) return null
    const date = new Date(value)
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }



  const calculatePercentage = (current: number, limit: number | null): number => {
    if (limit === null) return 0
    if (limit === 0) return 100
    return Math.min((current / limit) * 100, 100)
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive'
    if (percentage >= 75) return 'bg-warning'
    return 'bg-primary'
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border bg-card/60 px-6 py-5">
          <Link
            href={`/${locale}/settings`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('billingPage.backButton')}
          </Link>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t('billingPage.breadcrumb')}
          </div>
          <div className="mt-2">
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('billingPage.title')}</h1>
            <p className="text-muted-foreground">
              {t('billingPage.description')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-52" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!usageData) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border bg-card/60 px-6 py-5">
          <Link
            href={`/${locale}/settings`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('billingPage.backButton')}
          </Link>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t('billingPage.breadcrumb')}
          </div>
          <div className="mt-2">
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('billingPage.title')}</h1>
            <p className="text-muted-foreground">
              {t('billingPage.description')}
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            {t('billingPage.emptyState')}
          </CardContent>
        </Card>
      </div>
    )
  }

  const planKey = usageData.plan?.name ?? usageData.plan_name
  const planName = planKey
    ? getPlanLabel(planKey)
    : usageData.plan_id
      ? translateOrFallback('billingPage.planNames.unknown', 'Unknown plan')
      : translateOrFallback('billingPage.planNames.noPlan', 'No plan')
  const isTrial = usageData.billing_status === 'trial_active'
  const isPastDue = usageData.billing_status === 'past_due'
  const isTrialEnded = usageData.billing_status === 'trial_ended'
  const trialTimeLabel = usageData.trial_ends_at
    ? formatTrialTimeRemaining(usageData.trial_ends_at, locale)
    : null
  const planIntervalLabel = usageData.plan?.billing_interval
    ? translateOrFallback(
      `billingPage.planInterval.${usageData.plan?.billing_interval}`,
      usageData.plan?.billing_interval ?? ''
    )
    : null
  const planRenewalDate =
    usageData.subscription?.current_period_end || usageData.access_ends_at || usageData.trial_ends_at
  const planRenewalLabel = formatPlanDate(planRenewalDate)
  const cancelScheduleDate =
    usageData.subscription?.cancel_at || usageData.subscription?.current_period_end
  const cancelScheduleLabel = formatPlanDate(cancelScheduleDate)
  const isCancelScheduled = usageData.subscription?.cancel_at_period_end
  const daysUntilAccessEnd = usageData.days_until_access_end ?? null
  const showRenewalWarning =
    !isTrial &&
    daysUntilAccessEnd !== null &&
    daysUntilAccessEnd >= 0 &&
    daysUntilAccessEnd <= 5
  const showAccessExpiredWarning =
    !isTrial &&
    daysUntilAccessEnd !== null &&
    daysUntilAccessEnd < 0
  const limitItems = [
    {
      label: t('billingPage.usage.metrics.projects'),
      value: usageData.limits.projects ?? t('billingPage.usage.unlimited'),
    },
    {
      label: t('billingPage.usage.metrics.clients'),
      value: usageData.limits.clients ?? t('billingPage.usage.unlimited'),
    },
    {
      label: t('billingPage.usage.metrics.storage'),
      value: usageData.limits.storage_bytes
        ? formatBytes(usageData.limits.storage_bytes)
        : t('billingPage.usage.unlimited'),
    },
    {
      label: t('billingPage.usage.metrics.aiCredits'),
      value: usageData.limits.ai_credits ?? t('billingPage.usage.unlimited'),
    },
  ]

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <Link
          href={`/${locale}/settings`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('billingPage.backButton')}
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('billingPage.breadcrumb')}
        </div>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('billingPage.title')}</h1>
          <p className="text-muted-foreground">
            {t('billingPage.description')}
          </p>
        </div>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('billingPage.currentPlan.title')}
              </CardTitle>
              <CardDescription>{t('billingPage.currentPlan.description')}</CardDescription>
            </div>
            <Link href={`/${locale}/settings/billing/plans`}>
              <Button>
                {isTrial || isTrialEnded
                  ? t('billingPage.currentPlan.upgradeButton')
                  : t('billingPage.currentPlan.changeButton')}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-card/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{planName}</div>
                  {planIntervalLabel && (
                    <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {planIntervalLabel}
                    </div>
                  )}
                  {planRenewalLabel && (
                    <div className="text-sm text-muted-foreground">
                      {t('billingPage.currentPlan.renewalLabel', { date: planRenewalLabel })}
                    </div>
                  )}
                  {isCancelScheduled && cancelScheduleLabel && (
                    <div className="text-xs text-warning-foreground">
                      {t('billingPage.currentPlan.cancelAtPeriodEnd', {
                        date: cancelScheduleLabel,
                      })}
                    </div>
                  )}
                </div>
                <div className={`text-sm font-semibold ${isTrial ? 'text-warning' :
                  isPastDue || isTrialEnded ? 'text-destructive' :
                    'text-success'
                  }`}>
                  {usageData.billing_status.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {limitItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

            </div>

            {isTrial && usageData.trial_ends_at && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-center gap-2 text-warning-foreground">
                  <Zap className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{t('billingPage.currentPlan.trialPeriod')}</div>
                    <div className="text-sm">
                      {trialTimeLabel ?? translateOrFallback('billingPage.currentPlan.trialTimeExpired', 'Expired')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isTrialEnded && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive-foreground">
                  <TrendingUp className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{t('billingPage.currentPlan.trialEnded')}</div>
                    <div className="text-sm">{t('billingPage.currentPlan.trialEndedMessage')}</div>
                  </div>
                </div>
              </div>
            )}

            {isPastDue && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive-foreground">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{t('billingPage.currentPlan.paymentRequiredTitle')}</div>
                    <div className="text-sm">{t('billingPage.currentPlan.paymentRequiredMessage')}</div>
                  </div>
                </div>
              </div>
            )}

            {showRenewalWarning && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-semibold text-amber-900 dark:text-amber-100">
                      {translateOrFallback('billingPage.currentPlan.renewalWarningTitle', 'Renewal required soon')}
                    </div>
                    <div className="text-sm text-amber-800/90 dark:text-amber-200/90">
                      {translateOrFallback(
                        'billingPage.currentPlan.renewalWarningMessage',
                        'Your plan ends in {days} days. Renew to avoid automatic block.',
                      ).replace('{days}', formatDaysToExpiry(daysUntilAccessEnd, locale))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showAccessExpiredWarning && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive-foreground">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">
                      {translateOrFallback('billingPage.currentPlan.accessExpiredTitle', 'Plan expired')}
                    </div>
                    <div className="text-sm">
                      {translateOrFallback(
                        'billingPage.currentPlan.accessExpiredMessage',
                        'Your access period has expired. Renew your plan to unblock access.',
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Meters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('billingPage.usage.heading')}
          </CardTitle>
          <CardDescription>{t('billingPage.usage.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Projects */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.projects')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.projects} / {usageData.limits.projects ?? t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.projects !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.projects, usageData.limits.projects)}
                  className={getProgressColor(calculatePercentage(usageData.usage.projects, usageData.limits.projects))}
                />
              )}
            </div>

            {/* Clients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.clients')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.clients} / {usageData.limits.clients ?? t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.clients !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.clients, usageData.limits.clients)}
                  className={getProgressColor(calculatePercentage(usageData.usage.clients, usageData.limits.clients))}
                />
              )}
            </div>

            {/* Proposals */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.proposals')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.proposals} / {usageData.limits.proposals ?? t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.proposals !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.proposals, usageData.limits.proposals)}
                  className={getProgressColor(calculatePercentage(usageData.usage.proposals, usageData.limits.proposals))}
                />
              )}
            </div>

            {/* Users */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.team')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.users} / {usageData.limits.users ?? t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.users !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.users, usageData.limits.users)}
                  className={getProgressColor(calculatePercentage(usageData.usage.users, usageData.limits.users))}
                />
              )}
            </div>

            {/* Storage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.storage')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(usageData.usage.storage_bytes)} / {usageData.limits.storage_bytes ? formatBytes(usageData.limits.storage_bytes) : t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.storage_bytes !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.storage_bytes, usageData.limits.storage_bytes)}
                  className={getProgressColor(calculatePercentage(usageData.usage.storage_bytes, usageData.limits.storage_bytes))}
                />
              )}
            </div>

            {/* AI Credits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('billingPage.usage.metrics.aiCredits')}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.ai_credits} / {usageData.limits.ai_credits ?? t('billingPage.usage.unlimited')}
                </span>
              </div>
              {usageData.limits.ai_credits !== null && (
                <Progress
                  value={calculatePercentage(usageData.usage.ai_credits, usageData.limits.ai_credits)}
                  className={getProgressColor(calculatePercentage(usageData.usage.ai_credits, usageData.limits.ai_credits))}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <BillingHistory />
    </div>
  )
}
