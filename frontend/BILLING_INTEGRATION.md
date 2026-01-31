# Frontend Billing Integration Guide

## Overview

The frontend billing system provides automatic handling of plan limits (402 errors) and a seamless upgrade flow.

## Components

### 1. BillingProvider

Wrap your app with `BillingProvider` to enable automatic upgrade modals.

```tsx
// In your layout or root component
import { BillingProvider } from '@/contexts/BillingContext'

export default function Layout({ children }) {
  return (
    <BillingProvider>
      {children}
    </BillingProvider>
  )
}
```

### 2. useBillingGuard Hook

Use this hook to automatically show upgrade modals when API calls return 402 errors.

```tsx
import { useBillingGuard } from '@/hooks/useBillingGuard'
import { apiClient } from '@/lib/api/client'

function MyComponent() {
  const { guardedCall } = useBillingGuard()

  const createProject = async () => {
    // This will automatically show upgrade modal if limit is reached
    const result = await guardedCall(async () => {
      return await apiClient.post('/api/v1/projects', projectData)
    })

    if (result) {
      // Success - project created
      toast.success('Project created!')
    }
    // If result is null, it means a 402 error occurred and modal was shown
  }

  return <Button onClick={createProject}>Create Project</Button>
}
```

### 3. Manual Modal Control

You can also manually trigger the upgrade modal:

```tsx
import { useBilling } from '@/contexts/BillingContext'

function MyComponent() {
  const { showUpgradeModal } = useBilling()

  const checkLimit = () => {
    if (projectCount >= limit) {
      showUpgradeModal('You have reached your project limit')
    }
  }

  return <Button onClick={checkLimit}>Check Limit</Button>
}
```

## Pages

### Billing Dashboard (`/settings/billing`)

Shows:
- Current plan and billing status
- Trial countdown (if applicable)
- Usage meters for all resources
- Upgrade button

### Plan Selection (`/settings/billing/plans`)

Shows:
- Side-by-side plan comparison
- Stripe Checkout integration
- Enterprise contact form

## Usage Examples

### Example 1: Guarded API Call

```tsx
const { guardedCall } = useBillingGuard()

const handleSubmit = async () => {
  setIsLoading(true)

  const result = await guardedCall(async () => {
    return await apiClient.post('/api/v1/clients', formData)
  })

  if (result) {
    toast.success('Client created!')
    router.push('/clients')
  }
  // Upgrade modal shown automatically if 402

  setIsLoading(false)
}
```

### Example 2: Multiple Operations

```tsx
const { guardedCall } = useBillingGuard()

const handleBulkImport = async (items: any[]) => {
  for (const item of items) {
    const result = await guardedCall(async () => {
      return await apiClient.post('/api/v1/items', item)
    })

    if (!result) {
      // 402 error - stop import
      toast.info('Import stopped - upgrade required')
      break
    }
  }
}
```

### Example 3: Conditional Checks

```tsx
const { showUpgradeModal } = useBilling()
const [usage, setUsage] = useState<any>(null)

useEffect(() => {
  async function loadUsage() {
    const data = await apiClient.get('/api/v1/billing/usage')
    setUsage(data)
  }
  loadUsage()
}, [])

const canCreateProject = () => {
  if (!usage) return false

  const { projects } = usage.usage
  const { projects: limit } = usage.limits

  if (limit !== null && projects >= limit) {
    showUpgradeModal(`You have reached your limit of ${limit} projects`)
    return false
  }

  return true
}
```

## Error Handling

The `useBillingGuard` hook only intercepts 402 errors. All other errors are re-thrown and should be handled normally:

```tsx
const { guardedCall } = useBillingGuard()

try {
  const result = await guardedCall(async () => {
    return await apiClient.post('/api/v1/items', data)
  })

  if (result) {
    // Success
  }
} catch (error) {
  // Handle other errors (401, 403, 500, etc.)
  toast.error('Something went wrong')
}
```

## Stripe Checkout Flow

1. User clicks "Upgrade Plan" or "Select Plan"
2. Frontend calls `POST /api/v1/billing/create-checkout-session`
3. Backend creates Stripe Checkout Session and returns URL
4. Frontend redirects to Stripe-hosted checkout
5. User completes payment
6. Stripe redirects back to `/settings/billing?success=true`
7. Webhook updates organization billing status
8. User sees success message and updated plan

## Testing

To test the upgrade flow locally:

1. Run the backend with Stripe test keys
2. Use Stripe test cards (4242 4242 4242 4242)
3. Test webhook events with Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe
   ```

## Styling

The upgrade modal uses Tailwind CSS and shadcn/ui components. Customize colors in `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      warning: 'hsl(var(--warning))',
      // ... other colors
    }
  }
}
```
