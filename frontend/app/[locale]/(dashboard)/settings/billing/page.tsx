'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, CreditCard, TrendingUp, Zap, Users, FolderOpen, FileText, HardDrive, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'

interface UsageData {
  organization_id: string
  plan_id: string | null
  plan_name?: string | null
  billing_status: string
  trial_ends_at: string | null
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

const PLAN_NAMES: Record<string, string> = {
  pro_trial: 'Pro Trial',
  starter: 'Starter',
  pro: 'Pro',
  pro_annual: 'Pro Annual',
  enterprise: 'Enterprise',
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatTrialTimeRemaining = (trialEndsAt: string): string => {
  const now = new Date()
  const endsAt = new Date(trialEndsAt)
  const diff = endsAt.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`
  return `${hours} hour${hours > 1 ? 's' : ''} remaining`
}

export default function BillingPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')

    if (success === 'true') {
      toast.success('Subscription activated successfully!')
    } else if (canceled === 'true') {
      toast.info('Subscription upgrade canceled')
    }
  }, [searchParams])

  useEffect(() => {
    if (organizationId) {
      loadUsage()
    }
  }, [organizationId])

  const loadUsage = async () => {
    try {
      setIsLoading(true)
      const data = await apiClient.get<UsageData>('/api/v1/billing/usage')
      setUsageData(data)
    } catch (error) {
      console.error('Failed to load usage:', error)
      toast.error('Failed to load billing information')
    } finally {
      setIsLoading(false)
    }
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading billing information...</p>
        </div>
      </div>
    )
  }

  if (!usageData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">No billing information available</p>
        </div>
      </div>
    )
  }

  const planName = usageData.plan_name
    ? (PLAN_NAMES[usageData.plan_name] || usageData.plan_name)
    : (usageData.plan_id ? 'Unknown' : 'No Plan')
  const isTrial = usageData.billing_status === 'trial_active'
  const isPastDue = usageData.billing_status === 'past_due'
  const isTrialEnded = usageData.billing_status === 'trial_ended'

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <Link
          href={`/${locale}/settings`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings / Billing & Usage
        </div>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight font-display">Billing & Usage</h1>
          <p className="text-muted-foreground">
            Manage your subscription and monitor usage limits
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
                Current Plan
              </CardTitle>
              <CardDescription>Your active subscription plan</CardDescription>
            </div>
            <Link href={`/${locale}/settings/billing/plans`}>
              <Button>
                {isTrial || isTrialEnded ? 'Upgrade Plan' : 'Change Plan'}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{planName}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className={`text-sm ${
                  isTrial ? 'text-warning' :
                  isPastDue ? 'text-destructive' :
                  isTrialEnded ? 'text-destructive' :
                  'text-success'
                }`}>
                  {usageData.billing_status.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </div>

            {isTrial && usageData.trial_ends_at && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-center gap-2 text-warning-foreground">
                  <Zap className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">Trial Period</div>
                    <div className="text-sm">
                      {formatTrialTimeRemaining(usageData.trial_ends_at)}
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
                    <div className="font-semibold">Trial Ended</div>
                    <div className="text-sm">Please upgrade to continue using the platform</div>
                  </div>
                </div>
              </div>
            )}

            {isPastDue && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive-foreground">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">Payment Required</div>
                    <div className="text-sm">Please update your payment method to continue</div>
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
            Usage & Limits
          </CardTitle>
          <CardDescription>Monitor your current usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Projects */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Projects</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.projects} / {usageData.limits.projects ?? 'Unlimited'}
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
                  <span className="text-sm font-medium">Clients</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.clients} / {usageData.limits.clients ?? 'Unlimited'}
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
                  <span className="text-sm font-medium">Proposals</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.proposals} / {usageData.limits.proposals ?? 'Unlimited'}
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
                  <span className="text-sm font-medium">Team Members</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.users} / {usageData.limits.users ?? 'Unlimited'}
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
                  <span className="text-sm font-medium">Storage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(usageData.usage.storage_bytes)} / {usageData.limits.storage_bytes ? formatBytes(usageData.limits.storage_bytes) : 'Unlimited'}
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
                  <span className="text-sm font-medium">AI Credits</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usageData.usage.ai_credits} / {usageData.limits.ai_credits ?? 'Unlimited'}
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
    </div>
  )
}
