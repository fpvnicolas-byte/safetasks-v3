'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useLocale } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'

interface Plan {
  name: string
  displayName: string
  price: string
  interval: string
  priceId: string
  features: string[]
  recommended?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'starter',
    displayName: 'Starter',
    price: 'R$ 39,90',
    interval: 'mês',
    priceId: 'price_1SmKRMQBou9YDSD2HPqUgldI',
    features: [
      '5 projects',
      '20 clients',
      '20 proposals',
      '5 team members',
      '25GB storage',
      '100 AI credits/month',
    ],
  },
  {
    name: 'pro',
    displayName: 'Pro',
    price: 'R$ 89,90',
    interval: 'mês',
    priceId: 'price_1SpDHYQBou9YDSD2wu8zH3rt',
    features: [
      'Unlimited projects',
      'Unlimited clients',
      'Unlimited proposals',
      'Unlimited team members',
      '50GB storage',
      '1,000 AI credits/month',
    ],
    recommended: true,
  },
  {
    name: 'pro_annual',
    displayName: 'Pro Annual',
    price: 'R$ 755',
    interval: 'ano',
    priceId: 'price_1SpDYvQBou9YDSD2YsG88KQa',
    features: [
      'Unlimited projects',
      'Unlimited clients',
      'Unlimited proposals',
      'Unlimited team members',
      '75GB storage',
      '2,000 AI credits/month',
      'Save 2 months!',
    ],
  },
]

export default function PlansPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
  const autoCheckoutRef = useRef(false)

  const handleSelectPlan = async (plan: Plan) => {
    if (!organizationId) {
      toast.error('No organization found')
      return
    }

    try {
      setIsUpgrading(plan.name)

      const response = await apiClient.post<{ url: string }>('/api/v1/billing/create-checkout-session', {
        price_id: plan.priceId,
        success_url: `${window.location.origin}/${locale}/settings/billing?success=true`,
        cancel_url: `${window.location.origin}/${locale}/settings/billing/plans?canceled=true`,
      })

      // Redirect to Stripe Checkout
      window.location.href = response.url
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      toast.error('Failed to start checkout process')
      setIsUpgrading(null)
    }
  }

  useEffect(() => {
    if (autoCheckoutRef.current) return
    if (!organizationId) return

    const planKey = searchParams.get('plan')
    if (!planKey) return

    const selectedPlan = PLANS.find((plan) => plan.name === planKey)
    if (!selectedPlan) return

    autoCheckoutRef.current = true
    handleSelectPlan(selectedPlan)
  }, [organizationId, searchParams])

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <Link
          href={`/${locale}/settings/billing`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings / Billing / Plans
        </div>
        <div className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight font-display">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Select the plan that best fits your production needs
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${
              plan.recommended ? 'border-primary shadow-lg' : ''
            }`}
          >
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Recommended
                </div>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
              <CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </div>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={() => handleSelectPlan(plan)}
                disabled={isUpgrading !== null}
                variant={plan.recommended ? 'default' : 'outline'}
              >
                {isUpgrading === plan.name ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Select Plan'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enterprise Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Enterprise</CardTitle>
          <CardDescription>
            Custom solutions for large productions and agencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">Unlimited everything</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">Dedicated support</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">Custom integrations</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">SLA guarantees</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <a href="mailto:sales@safetasks.com">Contact Sales</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
