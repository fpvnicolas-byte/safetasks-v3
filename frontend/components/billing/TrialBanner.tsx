'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Zap, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LocaleLink } from '@/components/LocaleLink'
import { useAuth } from '@/contexts/AuthContext'

interface BillingUsage {
  billing_status: string
  trial_ends_at: string | null
}

const formatRelativeTime = (locale: string, diffMs: number) => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minuteMs = 1000 * 60
  const hourMs = minuteMs * 60
  const dayMs = hourMs * 24

  if (diffMs >= dayMs) {
    const days = Math.ceil(diffMs / dayMs)
    return rtf.format(days, 'day')
  }

  const hours = Math.max(1, Math.ceil(diffMs / hourMs))
  return rtf.format(hours, 'hour')
}

export function TrialBanner() {
  const t = useTranslations('billingBanner')
  const locale = useLocale()
  const { organizationId } = useAuth()
  const [usage, setUsage] = useState<BillingUsage | null>(null)

  useEffect(() => {
    if (!organizationId) {
      return
    }

    const load = async () => {
      try {
        const data = await apiClient.get<BillingUsage>('/api/v1/billing/usage')
        setUsage(data)
      } catch {
        // Silent fail; banner is optional.
      }
    }

    load()
  }, [organizationId])

  const trialInfo = useMemo(() => {
    if (!usage?.trial_ends_at) {
      return null
    }

    const endsAt = new Date(usage.trial_ends_at).getTime()
    const now = Date.now()
    const diffMs = endsAt - now

    return { endsAt, diffMs }
  }, [usage])

  if (!usage) {
    return null
  }

  const isTrialActive = usage.billing_status === 'trial_active'
  const isTrialEnded = usage.billing_status === 'trial_ended' || (trialInfo?.diffMs ?? 1) <= 0

  if (!isTrialActive && !isTrialEnded) {
    return null
  }

  const timeLabel = trialInfo ? formatRelativeTime(locale, trialInfo.diffMs) : t('timeFallback')

  return (
    <div className="px-6 pt-6">
      <Alert variant={isTrialEnded ? 'destructive' : 'default'} className="flex items-start justify-between gap-4">
        {isTrialEnded ? <TrendingUp /> : <Zap />}
        <div className="flex-1">
          <AlertTitle>
            {isTrialEnded ? t('trialEndedTitle') : t('trialEndingTitle')}
          </AlertTitle>
          <AlertDescription>
            <p>
              {isTrialEnded
                ? t('trialEndedMessage')
                : t('trialEndingMessage', { time: timeLabel })}
            </p>
          </AlertDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <LocaleLink href="/settings/billing/plans">
              {t('ctaPrimary')}
            </LocaleLink>
          </Button>
          <Button asChild size="sm" variant="outline">
            <LocaleLink href="/pricing">
              {t('ctaSecondary')}
            </LocaleLink>
          </Button>
        </div>
      </Alert>
    </div>
  )
}
