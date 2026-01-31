# Phase 3: Stripe Integration & Billing System - Design Document

**Date:** 2026-01-30
**Status:** Approved
**Author:** Claude (with user validation)

## Overview

This document outlines the complete design for Phase 3 of the RBAC v2 + Billing/Entitlements system. Phase 3 implements Stripe integration, organization registration with trials, and frontend billing UI.

## Architecture Overview

The billing system is built around three core components:

### 1. Stripe Webhook Handler
- Single endpoint (`POST /api/v1/billing/webhooks/stripe`) that receives events from Stripe
- Signature verification for security using `STRIPE_WEBHOOK_SECRET`
- Event processing with idempotency (using `BillingEvent` table to prevent duplicate processing)
- Updates `organizations` table fields: `billing_status`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`

### 2. Organization Registration Flow
- When new org is created, automatically assign `pro_trial` plan
- Set `billing_status = "trial_active"`
- Set `trial_ends_at = now() + 7 days`
- Create Stripe customer (store `stripe_customer_id`)
- No payment required upfront

### 3. Frontend Billing UI
- Settings page: `/settings/billing` showing current plan, usage, limits
- Plan selection/upgrade flow with Stripe Checkout
- Usage meters for projects, clients, proposals, storage, AI credits
- Upgrade prompts when limits are reached (402 errors)

### Key Design Decisions
- Stripe is source of truth for subscription state
- DB mirrors Stripe state via webhooks for fast reads
- Trial converts to `trial_ended` after 7 days (background job)
- Mutations blocked during `trial_ended`, `past_due`, `billing_pending_review` (402)
- All access blocked for `canceled`, `blocked` (403)

## Stripe Configuration

### Price IDs
- **Starter (monthly)**: `price_1SmKRMQBou9YDSD2HPqUgldI`
- **Pro (monthly)**: `price_1SpDHYQBou9YDSD2wu8zH3rt`
- **Pro Annual**: `price_1SpDYvQBou9YDSD2YsG88KQa`
- **Enterprise**: `null` (custom pricing)

### Webhook Events (11 total)
1. `checkout.session.completed`
2. `customer.created`
3. `customer.deleted`
4. `customer.subscription.created`
5. `customer.subscription.deleted`
6. `customer.subscription.trial_will_end`
7. `customer.subscription.updated`
8. `customer.updated`
9. `invoice.finalized`
10. `invoice.payment_failed`
11. `invoice.payment_succeeded`

## Stripe Webhook Event Handling

### Customer Events
- **`customer.created`** - Store `stripe_customer_id` on organization
- **`customer.updated`** - Update customer metadata if needed
- **`customer.deleted`** - Mark org as `billing_status = "canceled"`

### Subscription Lifecycle
- **`customer.subscription.created`** - Store `stripe_subscription_id`, set `plan_id` based on price ID, set `billing_status = "active"`
- **`customer.subscription.updated`** - Handle plan changes, update `plan_id` and `billing_status`
- **`customer.subscription.deleted`** - Set `billing_status = "canceled"`

### Payment Events
- **`invoice.payment_succeeded`** - Confirm `billing_status = "active"`, extend subscription
- **`invoice.payment_failed`** - Set `billing_status = "past_due"`, retry logic handled by Stripe
- **`invoice.finalized`** - Record upcoming invoice (optional notification)

### Checkout Events
- **`checkout.session.completed`** - Handle successful checkout, update subscription info

### Trial Events
- **`customer.subscription.trial_will_end`** - Send notification 3 days before trial ends (optional)

### Event Processing Flow
1. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Check `BillingEvent` table for `stripe_event_id` (idempotency - skip if already processed)
3. Insert record with `status = "received"`
4. Process event based on `event_type`
5. Update organization record
6. Set `status = "processed"` and `processed_at = now()`
7. Return 200 OK to Stripe

### Error Handling
- If processing fails, set `status = "failed"` in `BillingEvent`
- Return 200 OK anyway (Stripe will retry if we return 4xx/5xx)
- Log error for manual review

## Organization Registration Flow

### Backend Registration Endpoint Updates
**Endpoint:** `POST /api/v1/organizations` (or wherever org creation happens)

**Steps:**
1. Create organization record in DB
2. Look up `pro_trial` plan from `plans` table
3. Set `plan_id` to `pro_trial.id`
4. Set `billing_status = "trial_active"`
5. Set `trial_ends_at = now() + 7 days`
6. Create Stripe customer: `stripe.Customer.create(email=user_email, name=org_name, metadata={org_id: ...})`
7. Store `stripe_customer_id` on organization
8. Create initial `OrganizationUsage` record (all counters at 0)
9. Return organization to frontend

### Trial Expiration Handling
**Selected Approach:** Background job (Option A)

- Background job runs daily at midnight
- Checks `trial_ends_at < now()` AND `billing_status = "trial_active"`
- Updates to `billing_status = "trial_ended"`
- Mutations blocked with 402 error after expiration

### Trial Limits Enforcement
`pro_trial` entitlements (from seed script):
- 1 project
- 5 clients
- 3 proposals
- 2 users
- 5GB storage
- 50 AI credits

Existing `entitlements.py` functions enforce these limits. When trial ends, mutations blocked with 402 error.

## Frontend Billing UI

### New Pages

#### 1. Billing Dashboard: `/settings/billing`
**Features:**
- Current plan display (Starter, Pro, Pro Annual, Enterprise, or Trial)
- Trial countdown if `billing_status = "trial_active"` (e.g., "5 days remaining")
- Usage meters showing current vs. limits:
  - Projects: 3/5 (progress bar)
  - Clients: 12/20 (progress bar)
  - Proposals: 5/20 (progress bar)
  - Users: 2/5 (progress bar)
  - Storage: 2.3GB/25GB (progress bar)
  - AI Credits: 45/100 (progress bar)
- "Upgrade Plan" button (launches Stripe Checkout)
- Payment method display (if subscription exists)
- Billing history table (past invoices)

#### 2. Plan Selection: `/settings/billing/plans`
**Features:**
- Side-by-side comparison of Starter, Pro, Pro Annual
- Feature matrix showing entitlements
- "Current Plan" badge
- "Select Plan" buttons trigger Stripe Checkout Session
- Enterprise plan shows "Contact Sales"

### Upgrade Flow (using Stripe Checkout)
1. Frontend calls backend: `POST /api/v1/billing/create-checkout-session`
2. Backend creates Stripe Checkout Session with:
   - Selected `price_id`
   - Customer: `organization.stripe_customer_id`
   - Success URL: `/settings/billing?success=true`
   - Cancel URL: `/settings/billing?canceled=true`
3. Frontend redirects to Stripe-hosted checkout page
4. User completes payment on Stripe
5. Stripe redirects back to success URL
6. `checkout.session.completed` webhook updates organization

### Upgrade Prompts (when limits hit)
- 402 errors from backend trigger modal: "Plan limit reached. Upgrade to continue."
- Modal shows current usage and available plans
- "Upgrade Now" button goes to plan selection page

## Complete User Journeys

### New User Registration
1. User signs up → Frontend calls backend org creation
2. Backend creates org with `pro_trial` plan, `billing_status = "trial_active"`
3. Backend creates Stripe customer, stores `stripe_customer_id`
4. User gets 7-day trial with limited entitlements
5. User can create 1 project, 5 clients, etc.

### During Trial
1. User hits limit (e.g., tries to create 2nd project)
2. Backend checks entitlements, returns 402
3. Frontend shows "Upgrade to Pro" modal
4. User clicks upgrade → redirected to Stripe Checkout
5. User completes payment
6. Stripe sends `checkout.session.completed` webhook
7. Webhook handler updates org: `billing_status = "active"`, `plan_id = pro.id`
8. User now has unlimited projects

### Trial Expiration
1. Background job runs daily at midnight
2. Finds orgs where `trial_ends_at < now()` AND `billing_status = "trial_active"`
3. Updates to `billing_status = "trial_ended"`
4. Next mutation attempt returns 402 "Please upgrade to continue"

### Payment Failure
1. Stripe retries payment automatically (configured in Stripe Dashboard)
2. `invoice.payment_failed` webhook received
3. Handler sets `billing_status = "past_due"`
4. User gets 402 on mutations, can still read data
5. If payment succeeds later, `invoice.payment_succeeded` sets back to `active`

## Testing Strategy

### Development Testing
- Use Stripe test mode with test cards (4242 4242 4242 4242)
- Stripe CLI for local webhook testing:
  ```bash
  stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe
  ```
- Test events: trigger via Stripe Dashboard or CLI:
  ```bash
  stripe trigger payment_intent.succeeded
  ```

### Test Coverage
- Unit tests for entitlement checks
- Integration tests for webhook processing with mocked Stripe events
- End-to-end tests for registration → trial → upgrade flow

## Implementation Dependencies

### Backend
- Add `stripe` Python package to `requirements.txt`
- Update seed script with Stripe Price IDs
- Create webhook endpoint
- Create billing service layer
- Add background job for trial expiration
- Add checkout session creation endpoint

### Frontend
- Create `/settings/billing` page
- Create `/settings/billing/plans` page
- Add usage display components
- Add upgrade modals for 402 errors
- Integrate Stripe Checkout redirect flow

### Database
- Run migration `b1f3c9a4e6d2_add_access_billing_phase1.py` (already exists)
- Seed plans with `seed_plans_entitlements.py`

## Security Considerations

- Webhook signature verification is mandatory (using `STRIPE_WEBHOOK_SECRET`)
- Never expose `STRIPE_SECRET_KEY` to frontend
- Only `STRIPE_PUBLISHABLE_KEY` goes to frontend (for Checkout)
- Idempotency via `BillingEvent.stripe_event_id` prevents duplicate processing
- All billing mutations require authentication
- Owner/admin roles required for billing changes

## Next Steps

1. Add Stripe SDK to backend dependencies
2. Update seed script with Price IDs
3. Implement webhook endpoint and event handlers
4. Update organization creation endpoint
5. Create background job for trial expiration
6. Build frontend billing UI
7. Test complete flow end-to-end
