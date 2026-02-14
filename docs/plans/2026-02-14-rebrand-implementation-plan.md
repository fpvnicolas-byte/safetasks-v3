# Rebrand SafeTasks -> Produzo: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all "SafeTasks" / "Safe Tasks V3" branding with "Produzo" across the entire codebase.

**Architecture:** Pure string replacement — no logic, route, or behavior changes. The database name `safetasks` stays unchanged (internal, zero user impact). The tagline "Production OS", color scheme, and clapperboard icon all stay.

**Tech Stack:** Next.js 15 (frontend), FastAPI (backend), PostgreSQL, Supabase Auth

---

### Task 1: Core SEO & Structured Data (frontend source of truth)

**Files:**
- Modify: `frontend/lib/seo.ts:3-5,36-68`
- Modify: `frontend/lib/structured-data.ts:103`

**Step 1: Update seo.ts**

Replace all brand references in `frontend/lib/seo.ts`:

```
Line 3:  'https://safetasks.vercel.app' -> 'https://produzo.vercel.app'
Line 5:  SITE_NAME = 'SafeTasks' -> SITE_NAME = 'Produzo'
Line 36: 'SafeTasks | Film...' -> 'Produzo | Film...'
Line 37-38: 'SafeTasks helps...' -> 'Produzo helps...'
Line 39: 'SafeTasks | Production OS...' -> 'Produzo | Production OS...'
Line 42: 'SafeTasks Pricing...' -> 'Produzo Pricing...'
Line 44: 'SafeTasks plan...' -> 'Produzo plan...'
Line 45: 'SafeTasks — Billing...' -> 'Produzo — Billing...'
Line 47: 'SafeTasks subscriptions...' -> 'Produzo subscriptions...'
Line 48: 'About SafeTasks...' -> 'About Produzo...'
Line 50: 'SafeTasks — the production...' -> 'Produzo — the production...'
Line 54: 'SafeTasks | Plataforma...' -> 'Produzo | Plataforma...'
Line 56: 'SafeTasks ajuda...' -> 'Produzo ajuda...'
Line 57: 'SafeTasks | Sistema...' -> 'Produzo | Sistema...'
Line 60: 'Planos SafeTasks...' -> 'Planos Produzo...'
Line 62: 'plano SafeTasks...' -> 'plano Produzo...'
Line 63: 'SafeTasks — Cobrança...' -> 'Produzo — Cobrança...'
Line 65: 'plataforma SafeTasks...' -> 'plataforma Produzo...'
Line 66: 'Sobre o SafeTasks...' -> 'Sobre o Produzo...'
Line 68: 'SafeTasks — a plataforma...' -> 'Produzo — a plataforma...'
```

Use `replace_all` for `SafeTasks` -> `Produzo` within this file.

**Step 2: Update structured-data.ts**

In `frontend/lib/structured-data.ts`:

```
Line 103: 'Planos SafeTasks' -> 'Planos Produzo'
           'SafeTasks Plans' -> 'Produzo Plans'
```

**Step 3: Commit**

```bash
git add frontend/lib/seo.ts frontend/lib/structured-data.ts
git commit -m "rebrand: update SEO constants and structured data (SafeTasks -> Produzo)"
```

---

### Task 2: Dashboard & Public Headers

**Files:**
- Modify: `frontend/components/layout/Header.tsx:79-80`
- Modify: `frontend/components/public/PublicHeader.tsx:27`

**Step 1: Update Dashboard Header**

In `frontend/components/layout/Header.tsx`:

```
Line 79: <span className="md:hidden">SafeTasks</span>
      -> <span className="md:hidden">Produzo</span>

Line 80: <span className="hidden md:inline">SafeTasks V3</span>
      -> <span className="hidden md:inline">Produzo</span>
```

**Step 2: Update Public Header**

In `frontend/components/public/PublicHeader.tsx`:

```
Line 27: <div className="text-lg font-semibold tracking-tight">SafeTasks</div>
      -> <div className="text-lg font-semibold tracking-tight">Produzo</div>
```

**Step 3: Commit**

```bash
git add frontend/components/layout/Header.tsx frontend/components/public/PublicHeader.tsx
git commit -m "rebrand: update dashboard and public headers (SafeTasks -> Produzo)"
```

---

### Task 3: OpenGraph & Twitter Image Generators

**Files:**
- Modify: `frontend/app/[locale]/og/logo/route.tsx:48,51`
- Modify: `frontend/app/[locale]/opengraph-image.tsx:64,67`
- Modify: `frontend/app/[locale]/twitter-image.tsx:60`
- Modify: `frontend/app/[locale]/pricing/opengraph-image.tsx:49`
- Modify: `frontend/app/[locale]/pricing/twitter-image.tsx:58`

**Step 1: Update OG logo route**

In `frontend/app/[locale]/og/logo/route.tsx`:

```
Line 48: S -> P   (the letter inside the logo box)
Line 51: SafeTasks -> Produzo
```

**Step 2: Update landing OG image**

In `frontend/app/[locale]/opengraph-image.tsx`:

```
Line 64: S -> P   (letter in logo box)
Line 67: SafeTasks -> Produzo
```

**Step 3: Update landing Twitter image**

In `frontend/app/[locale]/twitter-image.tsx`:

```
Line 60: SafeTasks -> Produzo
```

**Step 4: Update pricing OG image**

In `frontend/app/[locale]/pricing/opengraph-image.tsx`:

```
Line 49: SafeTasks Pricing -> Produzo Pricing
```

**Step 5: Update pricing Twitter image**

In `frontend/app/[locale]/pricing/twitter-image.tsx`:

```
Line 58: SafeTasks -> Produzo
```

**Step 6: Commit**

```bash
git add frontend/app/\[locale\]/og/logo/route.tsx \
  frontend/app/\[locale\]/opengraph-image.tsx \
  frontend/app/\[locale\]/twitter-image.tsx \
  frontend/app/\[locale\]/pricing/opengraph-image.tsx \
  frontend/app/\[locale\]/pricing/twitter-image.tsx
git commit -m "rebrand: update all OG and Twitter image generators (SafeTasks -> Produzo)"
```

---

### Task 4: English Translation File (en.json)

**Files:**
- Modify: `frontend/messages/en.json`

**Step 1: Replace all brand references**

Use `replace_all` to change all occurrences in `frontend/messages/en.json`:

- `SafeTasks V3` -> `Produzo` (auth titles, footer — drops V3)
- `SafeTasks` -> `Produzo` (all remaining — ~40 occurrences)
- `safetasks.com` -> `produzo.app` (support, contact, privacy emails)
- `safetasks.app` -> `produzo.app` (noreply email)

Key lines to verify after replacement:
- Line 63: "Welcome to Produzo"
- Line 76: "Sign up for Produzo"
- Line 2625: "Welcome to Produzo!"
- Line 2838: "© 2026 Produzo. Built for audiovisual production."
- Line 3961: "support@produzo.app"
- Line 4028: "contact@produzo.app"
- Line 4032: "© 2026 Produzo. All rights reserved."

**Step 2: Commit**

```bash
git add frontend/messages/en.json
git commit -m "rebrand: update English translations (SafeTasks -> Produzo)"
```

---

### Task 5: Portuguese Translation File (pt-br.json)

**Files:**
- Modify: `frontend/messages/pt-br.json`

**Step 1: Replace all brand references**

Same replacement strategy as Task 4:

- `SafeTasks V3` -> `Produzo`
- `SafeTasks` -> `Produzo`
- `safetasks.com` -> `produzo.app`
- `safetasks.app` -> `produzo.app`

Key lines to verify:
- Line 63: "Bem-vindo ao Produzo"
- Line 76: "Cadastre-se no Produzo"
- Line 2838: "© 2026 Produzo. Feito para produções audiovisuais."
- Line 4032: "© 2026 Produzo. Todos os direitos reservados."

**Step 2: Commit**

```bash
git add frontend/messages/pt-br.json
git commit -m "rebrand: update Portuguese translations (SafeTasks -> Produzo)"
```

---

### Task 6: Onboarding & Billing Pages

**Files:**
- Modify: `frontend/app/[locale]/onboarding/page.tsx:88`
- Modify: `frontend/app/[locale]/(dashboard)/settings/billing/plans/page.tsx:258`

**Step 1: Update onboarding page**

In `frontend/app/[locale]/onboarding/page.tsx`:

```
Line 88: <CardTitle>Welcome to SafeTasks</CardTitle>
      -> <CardTitle>Welcome to Produzo</CardTitle>
```

**Step 2: Update billing plans page**

In `frontend/app/[locale]/(dashboard)/settings/billing/plans/page.tsx`:

```
Line 258: href="mailto:sales@safetasks.com"
       -> href="mailto:sales@produzo.app"
```

**Step 3: Commit**

```bash
git add frontend/app/\[locale\]/onboarding/page.tsx \
  "frontend/app/[locale]/(dashboard)/settings/billing/plans/page.tsx"
git commit -m "rebrand: update onboarding and billing pages (SafeTasks -> Produzo)"
```

---

### Task 7: Backend Core Config & Main App

**Files:**
- Modify: `backend/app/core/config.py:12,144`
- Modify: `backend/app/main.py:39,60-61,117`

**Step 1: Update config.py**

In `backend/app/core/config.py`:

```
Line 12: PROJECT_NAME: str = "Safe Tasks V3"
      -> PROJECT_NAME: str = "Produzo"

Line 144: # e.g. "https://api.safetasks.com/api/v1/billing/webhooks/infinitypay"
       -> # e.g. "https://api.produzo.app/api/v1/billing/webhooks/infinitypay"
```

Note: `POSTGRES_DB: str = "safetasks"` on line 55 stays unchanged (internal DB name).

**Step 2: Update main.py**

In `backend/app/main.py`:

```
Line 39: Safe Tasks V3 - Professional Video Production Management Platform
      -> Produzo - Professional Video Production Management Platform

Line 60: "name": "Safe Tasks Development Team",
      -> "name": "Produzo Development Team",

Line 61: "email": "dev@safetasks.com",
      -> "email": "dev@produzo.app",

Line 117: "https://safetasks.vercel.app",
        -> "https://produzo.vercel.app",
```

**Step 3: Commit**

```bash
git add backend/app/core/config.py backend/app/main.py
git commit -m "rebrand: update backend config and FastAPI app (SafeTasks -> Produzo)"
```

---

### Task 8: Backend Services (Email, Drive, Refunds)

**Files:**
- Modify: `backend/app/services/email_service.py:45,76,96,111`
- Modify: `backend/app/services/google_drive.py:389`
- Modify: `backend/app/services/manual_refunds.py:92`

**Step 1: Update email_service.py**

```
Line 45: "noreply@safetasks.app" -> "noreply@produzo.app"
Line 76: "noreply@safetasks.app" -> "noreply@produzo.app"
Line 96: "Your SafeTasks plan expires" -> "Your Produzo plan expires"
Line 111: "Your SafeTasks plan has expired" -> "Your Produzo plan has expired"
```

**Step 2: Update google_drive.py**

```
Line 389: "https://safetasks.vercel.app" -> "https://produzo.vercel.app"
```

**Step 3: Update manual_refunds.py**

```
Line 92: "noreply@safetasks.app" -> "noreply@produzo.app"
```

**Step 4: Commit**

```bash
git add backend/app/services/email_service.py backend/app/services/google_drive.py backend/app/services/manual_refunds.py
git commit -m "rebrand: update email, drive, and refund services (SafeTasks -> Produzo)"
```

---

### Task 9: Backend Secondary Files

**Files:**
- Modify: `backend/app/core/logging_config.py:4`
- Modify: `backend/app/db/session.py:51`
- Modify: `backend/app/api/v1/endpoints/financial.py:1104`
- Modify: `backend/app/services/stripe_connect.py:71`
- Modify: `backend/app/api/v1/endpoints/stripe_connect.py:130`

**Step 1: Update logging_config.py**

```
Line 4: "SafeTasks V3 AI service" -> "Produzo AI service"
```

**Step 2: Update session.py**

```
Line 51: "application_name": "safetasks-v3" -> "application_name": "produzo"
```

**Step 3: Update financial.py**

```
Line 1104: "This email was sent via SafeTasks" -> "This email was sent via Produzo"
```

**Step 4: Update stripe_connect.py**

```
Line 71: "authorizes SafeTasks" -> "authorizes Produzo"
```

**Step 5: Update stripe_connect endpoint**

```
Line 130: "authorizes SafeTasks" -> "authorizes Produzo"
```

**Step 6: Commit**

```bash
git add backend/app/core/logging_config.py backend/app/db/session.py \
  backend/app/api/v1/endpoints/financial.py backend/app/services/stripe_connect.py \
  backend/app/api/v1/endpoints/stripe_connect.py
git commit -m "rebrand: update backend secondary files (SafeTasks -> Produzo)"
```

---

### Task 10: Configuration & Infrastructure Files

**Files:**
- Modify: `docker-compose.yml:4,13,80,107`
- Modify: `backend/.env.example:2,6,14`

**Step 1: Update docker-compose.yml**

```
Line 4:   # Safe Tasks Backend API -> # Produzo Backend API
Line 13:  PROJECT_NAME=Safe Tasks V3 -> PROJECT_NAME=Produzo
Line 80:  PROJECT_NAME=Safe Tasks V3 -> PROJECT_NAME=Produzo
Line 107: PROJECT_NAME=Safe Tasks V3 -> PROJECT_NAME=Produzo
```

**Step 2: Update .env.example**

```
Line 2: # SAFE TASKS V3 - ENVIRONMENT CONFIGURATION -> # PRODUZO - ENVIRONMENT CONFIGURATION
Line 6: PROJECT_NAME=Safe Tasks V3 -> PROJECT_NAME=Produzo
Line 14: # Example (production): BACKEND_CORS_ORIGINS=https://safetasks.vercel.app,...
      -> # Example (production): BACKEND_CORS_ORIGINS=https://produzo.vercel.app,...
```

**Step 3: Commit**

```bash
git add docker-compose.yml backend/.env.example
git commit -m "rebrand: update Docker and env configuration (SafeTasks -> Produzo)"
```

---

### Task 11: README

**Files:**
- Modify: `README.md`

**Step 1: Replace all references**

Use `replace_all` for:
- `SafeTasks V3` -> `Produzo`
- `SafeTasks` -> `Produzo`
- `safetasks-v3` -> `produzo` (in git clone URLs, issue links)
- `safetasks` -> `produzo` (in database URL example)

**Step 2: Commit**

```bash
git add README.md
git commit -m "rebrand: update README (SafeTasks -> Produzo)"
```

---

### Task 12: Test Files & Scripts (Low Priority)

**Files:**
- Modify: `backend/app/tests/services/test_infinitypay_billing_comprehensive.py`
- Modify: `backend/app/tests/test_stripe_connect_v1.py`
- Modify: `backend/app/tests/test_brain_v1.py`
- Modify: `backend/tests/verify_fix_proposal_delete.py`
- Modify: `backend/scripts/create_test_notifications.py`
- Modify: `backend/create_test_data.py`
- Modify: `backend/RUN_MIGRATION_V3.sh`

**Step 1: For each test file, replace brand references**

Use `replace_all` in each file:
- `safetasks.vercel.app` -> `produzo.vercel.app`
- `safetasks.com` -> `produzo.app`
- `safetasks.app` -> `produzo.app`
- `app.safetasks.com` -> `app.produzo.app`
- `api.safetasks.com` -> `api.produzo.app`
- `SafeTasks` -> `Produzo`
- `Safe Tasks` -> `Produzo`

Note: In `RUN_MIGRATION_V3.sh`, the `psql` commands reference the `safetasks` database name — leave those unchanged (database name stays).

**Step 2: Commit**

```bash
git add backend/app/tests/ backend/tests/ backend/scripts/ backend/create_test_data.py backend/RUN_MIGRATION_V3.sh
git commit -m "rebrand: update test files and scripts (SafeTasks -> Produzo)"
```

---

### Task 13: Final Verification

**Step 1: Search for any remaining references**

Run a global search for any leftover brand references:

```bash
grep -ri "safetasks\|safe.tasks" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.sh" --include="*.env*" . | grep -v node_modules | grep -v .git | grep -v "POSTGRES_DB" | grep -v "psql.*safetasks"
```

Expected: Only `POSTGRES_DB` and `psql` database references should remain (intentionally kept).

**Step 2: Build frontend to verify no broken imports**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit any fixes if needed**

```bash
git add -A && git commit -m "rebrand: fix remaining references found during verification"
```

**Step 4: Final commit summarizing the rebrand**

If all tasks committed individually, no final commit needed. Verify with `git log --oneline` that all rebrand commits are present.
