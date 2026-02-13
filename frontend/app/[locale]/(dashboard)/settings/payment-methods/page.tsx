'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useStripeConnectStatus, useStripeConnectOnboard, useStripeConnectDisconnect } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, CreditCard, ExternalLink, CheckCircle2, XCircle, Loader2, Unlink } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function PaymentMethodsPage() {
  const t = useTranslations('settings.paymentMethods')
  const tCommon = useTranslations('common')
  const { organizationId } = useAuth()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const searchParams = useSearchParams()

  const { data: connectStatus, isLoading, error, refetch } = useStripeConnectStatus()
  const onboard = useStripeConnectOnboard()
  const disconnect = useStripeConnectDisconnect()

  // Handle OAuth callback redirect params
  useEffect(() => {
    if (searchParams.get('stripe_connected') === 'true') {
      toast.success('Stripe account connected successfully!')
      refetch()
      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname)
    }
    const stripeError = searchParams.get('stripe_error')
    if (stripeError) {
      toast.error(`Stripe connection failed: ${stripeError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams, refetch])

  const handleConnect = async () => {
    try {
      // The redirect_uri must point to the BACKEND callback endpoint
      // because Stripe redirects there after OAuth, and the backend
      // exchanges the code for the connected account ID
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const redirectUri = `${backendUrl}/api/v1/stripe-connect/callback`
      const result = await onboard.mutateAsync(redirectUri)
      // Redirect to Stripe OAuth
      window.location.href = result.authorization_url
    } catch (err: unknown) {
      toast.error(err.message || t('errors.connectFailed'))
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await disconnect.mutateAsync()
      toast.success(t('disconnected'))
      refetch()
    } catch (err: unknown) {
      toast.error(err.message || t('errors.disconnectFailed'))
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isConnected = connectStatus?.connected ?? false
  const chargesEnabled = connectStatus?.charges_enabled ?? false
  const payoutsEnabled = connectStatus?.payouts_enabled ?? false
  const stripeDashboardBase =
    connectStatus?.livemode === false ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com'
  const stripeAccountId = connectStatus?.account_id
  const stripeDashboardUrl = typeof stripeAccountId === 'string' && stripeAccountId.startsWith('acct_')
    ? `${stripeDashboardBase}/${stripeAccountId}/`
    : `${stripeDashboardBase}/`
  const openStripeDashboard = () => window.open(stripeDashboardUrl, '_blank', 'noopener,noreferrer')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <span>/</span>
          <span>{t('title')}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tCommon('back')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stripe Connect Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/15 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{t('stripe.title')}</CardTitle>
                <CardDescription>{t('stripe.description')}</CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? 'success' : 'secondary'}>
              {isConnected ? t('stripe.connected') : t('stripe.notConnected')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
            </Alert>
          )}

          {!isConnected ? (
            /* Not Connected State */
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">{t('stripe.connectPrompt.title')}</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t('stripe.connectPrompt.description')}
                </p>
                <Button
                  onClick={handleConnect}
                  disabled={onboard.isPending}
                  className="mt-2"
                >
                  {onboard.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  {onboard.isPending ? t('stripe.connecting') : t('stripe.connectButton')}
                </Button>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t('stripe.benefits.title')}</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>{t('stripe.benefits.item1')}</li>
                  <li>{t('stripe.benefits.item2')}</li>
                  <li>{t('stripe.benefits.item3')}</li>
                  <li>{t('stripe.benefits.item4')}</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Connected State */
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">{t('stripe.details.accountId')}</div>
                  <div className="font-mono text-sm">{connectStatus?.account_id}</div>
                </div>
                {connectStatus?.business_name && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-sm text-muted-foreground">{t('stripe.details.businessName')}</div>
                    <div className="font-medium">{connectStatus.business_name}</div>
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">{t('stripe.details.charges')}</div>
                  <div className="flex items-center gap-2">
                    {chargesEnabled ? (
                      <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-success">{t('stripe.details.enabled')}</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">{t('stripe.details.disabled')}</span></>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">{t('stripe.details.payouts')}</div>
                  <div className="flex items-center gap-2">
                    {payoutsEnabled ? (
                      <><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-success">{t('stripe.details.enabled')}</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">{t('stripe.details.disabled')}</span></>
                    )}
                  </div>
                </div>
              </div>

              {connectStatus?.error && (
                <Alert variant="destructive">
                  <AlertDescription>{connectStatus.error}</AlertDescription>
                </Alert>
              )}

              {connectStatus?.enabled_at && (
                <p className="text-sm text-muted-foreground">
                  {t('stripe.details.connectedSince', { date: new Date(connectStatus.enabled_at).toLocaleDateString() })}
                </p>
              )}

              {/* Alert when setup is pending */}
              {(!chargesEnabled || !payoutsEnabled) && (
                <Alert>
                  <AlertDescription className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t('stripe.setupPending')}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={openStripeDashboard}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('stripe.completeSetup')}
                      </Button>
                    </div>

                    {connectStatus?.requirements && (
                      <div className="text-xs text-muted-foreground space-y-2">
                        {connectStatus.requirements.disabled_reason && (
                          <div>
                            <span className="font-medium text-foreground">{t('stripe.setupDetails.disabledReason')}:</span>{' '}
                            <span className="font-mono">{connectStatus.requirements.disabled_reason}</span>
                          </div>
                        )}

                        {[
                          { label: t('stripe.setupDetails.currentlyDue'), items: connectStatus.requirements.currently_due },
                          { label: t('stripe.setupDetails.pastDue'), items: connectStatus.requirements.past_due },
                          { label: t('stripe.setupDetails.pendingVerification'), items: connectStatus.requirements.pending_verification },
                          { label: t('stripe.setupDetails.eventuallyDue'), items: connectStatus.requirements.eventually_due },
                        ].some((group) => Array.isArray(group.items) && group.items.length > 0) ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              { label: t('stripe.setupDetails.currentlyDue'), items: connectStatus.requirements.currently_due },
                              { label: t('stripe.setupDetails.pastDue'), items: connectStatus.requirements.past_due },
                              { label: t('stripe.setupDetails.pendingVerification'), items: connectStatus.requirements.pending_verification },
                              { label: t('stripe.setupDetails.eventuallyDue'), items: connectStatus.requirements.eventually_due },
                            ]
                              .filter((group) => Array.isArray(group.items) && group.items.length > 0)
                              .map((group) => (
                                <div key={group.label} className="space-y-1">
                                  <div className="font-medium text-foreground">{group.label}</div>
                                  <ul className="ml-4 list-disc space-y-0.5">
                                    {group.items.slice(0, 6).map((item) => (
                                      <li key={item}>
                                        <span className="font-mono">{item}</span>
                                      </li>
                                    ))}
                                    {group.items.length > 6 && (
                                      <li>
                                        <span className="font-mono">+{group.items.length - 6}</span>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div>{t('stripe.setupDetails.none')}</div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={openStripeDashboard}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('stripe.manageDashboard')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  {isDisconnecting ? t('stripe.disconnecting') : t('stripe.disconnectButton')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
