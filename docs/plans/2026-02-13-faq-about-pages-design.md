# FAQ & About Us Pages Design

## Overview

Create public (unauthenticated) FAQ and About Us pages with Brazilian legal compliance (CDC, LGPD). Extract shared public layout from landing page for consistent navigation across all public pages.

## Architecture

### Shared Public Layout

Extract reusable components from landing page:

- **`components/public/PublicHeader.tsx`** - Logo + nav (Pricing, FAQ, About, Sign In, Get Started)
- **`components/public/PublicFooter.tsx`** - Copyright + legal links + language selector
- **`app/[locale]/(public)/layout.tsx`** - Route group layout wrapping all public pages

Pages using shared layout: Landing (`/`), Pricing (`/pricing`), FAQ (`/faq`), About (`/about`)

Landing page keeps its section anchors (Modules, Workflow, Features) as additional nav items.

### FAQ Page

**Route:** `/[locale]/faq`

Accordion-based FAQ organized by categories:

1. **Subscriptions & Plans** - Available plans, free trial, upgrade/downgrade, payment methods
2. **Refund Policy** (CDC Art. 49) - 7-day withdrawal right, refund request process, processing timeline, pro-rata refunds
3. **Cancellation** - How to cancel, data retention after cancellation
4. **Privacy & Data Protection** (LGPD) - Data collection, processing basis, user rights (access, correction, deletion, portability), how to exercise rights, storage location
5. **Account & Security** - Create/delete account, password recovery, 2FA, team management
6. **Platform Usage** - Supported browsers, mobile access, data export, storage limits

### About Us Page

**Route:** `/[locale]/about`

Sections:
1. **Hero** - Mission statement
2. **Our Story** - Why SafeTasks was built, pain points solved
3. **Our Values** - 3-4 values in card grid (Simplicity, Security, Collaboration, Innovation)
4. **Team** - Member cards with photo placeholder, name, role, bio
5. **Contact** - Email, social links, CTA

### SEO & Routing

- Add `/faq` and `/about` to `PUBLIC_INDEXABLE_PATHS` in `lib/seo.ts`
- Add SEO metadata for both pages in both locales
- Update `sitemap.ts` and `robots.ts`
- Full i18n in `messages/en.json` and `messages/pt-br.json`

### Design System

Same as existing public pages:
- Beige/cream background (`#f2ece2`)
- Serif headings (Iowan Old Style)
- Sans-serif body (Avenir Next)
- shadcn/ui components (Card, Accordion, Button)
- Amber accents, slate text
- Responsive, mobile-first

## Brazilian Legal Compliance

- **CDC Art. 49**: 7-day right of withdrawal clearly stated in refund policy FAQ
- **LGPD**: Data rights section covering all required disclosures (access, correction, deletion, portability, data processing basis)
- **Marco Civil da Internet**: Data retention and storage transparency
