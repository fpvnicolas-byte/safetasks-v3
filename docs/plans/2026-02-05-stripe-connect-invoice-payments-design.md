# Stripe Connect Invoice Payments — Design Document

**Date:** 2026-02-05
**Status:** Draft
**Feature:** Allow organizations to receive invoice payments from their clients via Stripe

---

## Overview

SafeTasks currently uses Stripe for platform subscription billing (organizations pay SafeTasks). This feature adds a second Stripe integration: **Stripe Connect**, allowing organizations to receive payments from their own clients for invoices generated within SafeTasks.

The key principle is simplicity: no Stripe Product/Price registration needed. Each checkout session is created dynamically with the invoice amount using `price_data`. Money flows directly to the organization's Stripe account.

---

## Architecture Decision: Stripe Connect (Standard)

**Why Stripe Connect?** Each organization needs their own Stripe account to receive payments. Stripe Connect is the official way for platforms to facilitate payments on behalf of connected accounts.

**Why Standard accounts?**
- Organizations get their own full Stripe Dashboard
- Stripe handles all KYC, compliance, and disputes
- SafeTasks has minimal liability
- Organizations configure their own payment methods (PIX, Boleto, Cards) in their Stripe Dashboard
- Simplest integration for the platform

---

## Flow

### Setup (one-time per organization)

1. Admin navigates to **Settings → Payment Methods → Stripe**
2. Clicks **"Connect Stripe Account"** → redirected to Stripe OAuth
3. Authorizes SafeTasks → redirected back with authorization code
4. SafeTasks exchanges code for `stripe_connect_account_id`, stores it on the organization
5. Organization is now ready to accept payments

### Payment (per invoice)

1. Admin opens an invoice (status: `sent`)
2. Clicks **"Generate Payment Link"**
3. SafeTasks creates a Stripe Checkout Session on the connected account:
   - Uses `price_data` with invoice total and description (no pre-registered product)
   - Uses `automatic_payment_methods` (Stripe decides PIX/Boleto/Card based on connected account config)
   - Sets `success_url` and `cancel_url`
   - Stores `checkout_session_id` on the invoice
4. Returns the checkout URL → admin copies or sends to client
5. Client clicks link → Stripe Checkout → pays
6. Stripe fires `checkout.session.completed` webhook
7. SafeTasks webhook handler:
   - Finds invoice by `stripe_checkout_session_id`
   - Marks invoice as `paid`
   - Creates a Transaction record (income, paid)
   - Updates bank account balance (if configured)
   - Logs audit event

---

## Data Model Changes

### Organization (extend existing model)

```python
# New fields on Organization
stripe_connect_account_id: Optional[str]           # e.g., "acct_xxx"
stripe_connect_onboarding_complete: bool = False    # Onboarding finished?
stripe_connect_enabled_at: Optional[datetime]       # When connected
```

### Invoice (extend existing model)

```python
# New fields on Invoice
payment_method: Optional[str]                # Selected payment method (see enum below)
stripe_checkout_session_id: Optional[str]    # Checkout Session ID
stripe_payment_intent_id: Optional[str]      # PaymentIntent ID (after payment)
payment_link_url: Optional[str]              # Generated checkout URL
payment_link_expires_at: Optional[datetime]  # Checkout session expiry (24h default)
paid_at: Optional[datetime]                  # When payment was confirmed
paid_via: Optional[str]                      # Actual method used: "stripe_card", "stripe_pix", "stripe_boleto", "manual"
```

### Invoice Payment Method Enum

The `payment_method` field on the invoice defines **how the client is expected to pay**. This is set by the admin when creating/editing the invoice.

```python
class InvoicePaymentMethod(str, Enum):
    STRIPE = "stripe"                # Online payment via Stripe (enables payment link generation)
    BANK_TRANSFER = "bank_transfer"  # Manual bank transfer / TED / DOC
    PIX_MANUAL = "pix_manual"        # PIX sent manually (not via Stripe)
    BOLETO_MANUAL = "boleto_manual"  # Boleto generated outside Stripe
    CASH = "cash"                    # Cash payment
    OTHER = "other"                  # Other method
```

**Behavior per method:**
- `stripe` → "Generate Payment Link" button appears on invoice detail. Auto-mark as paid via webhook.
- All others → Invoice must be manually marked as paid by the admin. The selected method is displayed on the invoice PDF and detail page for reference.

No new tables required.

---

## API Endpoints

### Stripe Connect Onboarding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/stripe-connect/onboard` | Initiates OAuth flow. Returns Stripe authorization URL. |
| GET | `/api/v1/stripe-connect/callback` | OAuth callback. Exchanges code for account ID. |
| GET | `/api/v1/stripe-connect/status` | Returns connection status for current org. |
| DELETE | `/api/v1/stripe-connect/disconnect` | Disconnects the org's Stripe account. |

### Invoice Payment

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/invoices/{invoice_id}/payment-link` | Creates Checkout Session, returns payment URL. |
| GET | `/api/v1/invoices/{invoice_id}/payment-status` | Returns current payment status. |

### Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/stripe-connect` | Receives connected account events. Separate from existing `/webhooks/stripe`. |

---

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` (payment_status: paid) | Mark invoice as paid, create transaction, update balance |
| `checkout.session.completed` (payment_status: unpaid) | Boleto generated but not yet paid — mark as "awaiting_payment" |
| `checkout.session.async_payment_succeeded` | Boleto cleared — mark invoice as paid |
| `checkout.session.async_payment_failed` | Boleto expired/failed — notify admin |
| `account.updated` | Track onboarding status changes |

---

## Checkout Session Creation

```python
# Pseudocode for creating checkout session
stripe.checkout.Session.create(
    line_items=[{
        "price_data": {
            "currency": invoice.currency or "brl",
            "product_data": {
                "name": f"Invoice #{invoice.invoice_number}",
                "description": invoice.description or "Invoice payment",
            },
            "unit_amount": invoice.total_amount_cents,  # Amount in cents
        },
        "quantity": 1,
    }],
    mode="payment",
    automatic_payment_methods={"enabled": True},
    success_url=f"{frontend_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
    cancel_url=f"{frontend_url}/payment/cancelled?invoice_id={invoice.id}",
    metadata={
        "invoice_id": str(invoice.id),
        "organization_id": str(invoice.organization_id),
    },
    stripe_account=organization.stripe_connect_account_id,  # Connected account
)
```

Key: `stripe_account` parameter routes the session to the connected org's account. `price_data` means no pre-registered product needed.

---

## Edge Cases

1. **Expired checkout links** — Stripe Checkout Sessions expire after 24h. Admin can regenerate.
2. **Duplicate webhooks** — Check if invoice is already `paid` before processing. Idempotent.
3. **Boleto async** — Boleto isn't instant. Handle `async_payment_succeeded` separately.
4. **Disconnected account** — If org disconnects Stripe, existing payment links stop working. Show appropriate error.
5. **Partial payments** — Not supported. Each checkout is for the full invoice amount.
6. **Currency** — Use the invoice's currency. Default to BRL.
7. **Refunds** — Out of scope for v1. Orgs handle refunds via their own Stripe Dashboard.

---

## Frontend UI

### 1. Settings → Payment Methods (new page)

Route: `/settings/payment-methods`

- **Not connected:** "Connect Stripe Account" button → OAuth redirect
- **Connected:** Shows account info (business name), connection date, "Disconnect" option
- Future-proof for other payment providers

### 2. Invoice Create/Edit — Payment Method Selector

When creating or editing an invoice, a **"Payment Method"** dropdown is shown:

- Options: Stripe, Bank Transfer, PIX (manual), Boleto (manual), Cash, Other
- If org has NOT connected Stripe, the "Stripe" option is disabled with a tooltip: "Connect your Stripe account in Settings → Payment Methods"
- Default: no selection (admin must choose)
- Displayed on the invoice PDF alongside payment instructions

### 3. Invoice Detail — Payment Link Section

On invoice detail page (when payment_method is `stripe`, status is `sent`, and Stripe is connected):

- **No link:** "Generate Payment Link" button
- **Link active:** Copyable URL, expiration countdown, payment status indicator
- **Link expired:** "Regenerate Link" button
- **Paid:** "Paid via Stripe (PIX/Card/Boleto)" badge with timestamp

For non-Stripe payment methods, show a "Mark as Paid" button instead (existing manual flow).

### 4. Invoice List — Payment Indicator

- Badge/icon showing payment link status (active, expired, paid)
- Visual distinction: Stripe-paid vs manually-marked-as-paid

### 5. Public Pages (no auth required)

- `/payment/success` — "Payment received! Thank you." confirmation page
- `/payment/cancelled` — "Payment cancelled." with option to retry

---

## Configuration

### New Environment Variables

```
STRIPE_CONNECT_CLIENT_ID=ca_xxx          # Stripe Connect OAuth client ID
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx  # Separate webhook secret for Connect events
```

### Stripe Dashboard Setup

1. Register SafeTasks as a Stripe Connect platform
2. Configure OAuth redirect URI: `{backend_url}/api/v1/stripe-connect/callback`
3. Create a separate webhook endpoint for Connect events pointing to `/api/v1/webhooks/stripe-connect`
4. Enable "Listen to events on Connected accounts"

---

## Implementation Order

1. **Database migration** — Add new fields to Organization and Invoice
2. **Stripe Connect service** — OAuth onboarding, account status, disconnect
3. **Connect API endpoints** — Onboard, callback, status, disconnect
4. **Payment link service** — Create checkout session, track status
5. **Payment link endpoint** — Generate link for invoice
6. **Connect webhook handler** — Process payment events, auto-mark paid
7. **Frontend: Settings page** — Stripe Connect onboarding UI
8. **Frontend: Invoice payment link** — Generate, display, copy link
9. **Frontend: Public success/cancel pages** — Post-payment landing pages
10. **Testing** — End-to-end with Stripe test mode

---

## Out of Scope (v1)

- Platform fees / commission (no `application_fee_amount`)
- Refund management through SafeTasks
- Recurring/subscription payments for invoices
- Email sending of payment links (admin copies and sends manually)
- Admin notifications when invoice is paid
- Multiple payment links per invoice (one at a time)
- Partial payments
