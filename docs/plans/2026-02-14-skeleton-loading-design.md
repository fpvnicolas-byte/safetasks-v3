# Skeleton-First Loading Architecture

## Problem

The app has two competing loading systems that create a jarring UX:

1. **Next.js `loading.tsx` files** (12 files) show skeleton UIs during server-side streaming
2. **Client-side code** (51+ files) shows `Loader2` spinners via `next/dynamic` fallbacks and `isLoading` conditional rendering

The result: users see a skeleton, then it disappears and a spinner appears, then content loads. The skeleton-to-spinner flash undermines the purpose of having skeletons at all.

Additionally, some pages show a double-loading sequence: `loading.tsx` skeleton, then a client-side `isLoading` early return with a different skeleton or spinner.

## Decision

**Approach 1: Skeleton-First Architecture** — Replace all spinners with content-matched skeletons and eliminate double-loading by separating page-level vs section-level loading.

## Design

### New Skeleton Components

Add to `components/LoadingSkeletons.tsx`:

| Skeleton | Used For | Shape |
|----------|----------|-------|
| `FinancialOverviewSkeleton` | Overview tab (3 stat cards) | 3-col grid of card skeletons |
| `ApprovalsDashboardSkeleton` | Approvals tab | Two sections with list items |
| `ProjectsFinancialsSkeleton` | Projects financials tab | Card grid with budget bars |
| `InvoicesTabSkeleton` | Invoices tab | Filter bar + table rows |
| `BankAccountsTabSkeleton` | Bank accounts tab | Card list with account details |
| `TransactionsTabSkeleton` | Transactions tab | Table with date/amount/description |
| `ExpensesTabSkeleton` | Expenses tab | Table with category/amount columns |
| `ChartSkeleton` | Revenue/analytics charts | Rectangular chart placeholder |
| `QuickActionsSkeleton` | Dashboard quick actions | Row of action buttons |
| `AssignmentsSkeleton` | Shooting day assignments | List with avatar + role |
| `TabContentSkeleton` | Generic tab fallback | Header + content blocks |

### Replacing Spinners

**Dynamic imports**: Replace all `loading: () => <Loader2 spinner>` with `loading: () => <MatchingSkeleton />`.

**Conditional isLoading checks**: Replace spinner renders with matching skeletons.

**Exception**: Mutation spinners inside buttons (delete, save, approve) stay as `Loader2` spinners — this is standard button loading UX.

### Eliminating Double Loading

Pages with `loading.tsx` should NOT show full-page loading states in client code. Instead:

1. `loading.tsx` covers the initial server-to-client transition (full-page skeleton)
2. Once the client component mounts, show section-level skeletons inside the already-visible layout (e.g. tab content skeleton while header/tabs are visible)
3. Remove early `if (isLoading) return <FullPageSkeleton>` patterns; replace with inline section skeletons

**Result**: `loading.tsx` skeleton -> page shell with header/tabs -> section skeletons in content area -> content fills in.

### Files to Modify

**Core:**
- `components/LoadingSkeletons.tsx` — Add ~11 new skeleton variants
- `app/[locale]/(dashboard)/financials/page.tsx` — 7 dynamic import spinners + 1 isLoading spinner
- `app/[locale]/(dashboard)/dashboard/page.tsx` — Dynamic import spinners + early return skeleton
- `app/[locale]/(dashboard)/projects/[id]/page.tsx` — Tab spinners
- `app/[locale]/(dashboard)/shooting-days/[id]/page.tsx` — Assignment spinner
- All other pages with Loader2 in conditional rendering (~8 more files)

**No changes needed:**
- `loading.tsx` files (already correct)
- `components/ui/skeleton.tsx` (base component is fine)
- Mutation spinners inside buttons (stay as spinners)
