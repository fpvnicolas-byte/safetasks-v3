# Skeleton-First Loading Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all Loader2 spinners with content-matched skeleton components and eliminate double-loading flashes.

**Architecture:** Create new skeleton variants in `LoadingSkeletons.tsx` matching each tab/section layout. Replace all `next/dynamic` loading fallbacks and `isLoading` conditional spinners with the matching skeleton. Keep mutation/button spinners as-is.

**Tech Stack:** Next.js 15, React, shadcn/ui (Skeleton component), Tailwind CSS, React Query, next/dynamic

---

### Task 1: Add Financial Tab Skeleton Components

**Files:**
- Modify: `frontend/components/LoadingSkeletons.tsx`

**Step 1: Add FinancialOverviewSkeleton**

Add to `LoadingSkeletons.tsx` after the existing exports:

```tsx
export function FinancialOverviewSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**Step 2: Add ApprovalCardSkeleton**

```tsx
export function ApprovalCardSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Add InvoicesTabSkeleton**

```tsx
export function InvoicesTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Add TransactionListSkeleton (shared by transactions, expenses, bank accounts tabs)**

```tsx
export function TransactionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
        <div className="flex justify-center pt-2">
          <Skeleton className="h-9 w-36" />
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 5: Add ProjectsFinancialsSkeleton**

```tsx
export function ProjectsFinancialsSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add frontend/components/LoadingSkeletons.tsx
git commit -m "feat: add financial tab skeleton components"
```

---

### Task 2: Replace Financials Page Spinners

**Files:**
- Modify: `frontend/app/[locale]/(dashboard)/financials/page.tsx`

**Step 1: Update imports**

Replace the `Loader2` import with skeleton imports:

```tsx
// Remove Loader2 from lucide-react import (keep Plus)
import { Plus } from 'lucide-react'
// Add skeleton imports
import {
  FinancialOverviewSkeleton,
  ApprovalCardSkeleton,
  ProjectsFinancialsSkeleton,
  InvoicesTabSkeleton,
  TransactionListSkeleton,
} from '@/components/LoadingSkeletons'
```

**Step 2: Replace all 7 dynamic import loading props**

Replace each `loading: () => <div className="flex justify-center py-8"><Loader2 ...` with the matching skeleton:

- `ExpenseApprovalDashboard` → `loading: () => <ApprovalCardSkeleton />`
- `BudgetApprovalDashboard` → `loading: () => <ApprovalCardSkeleton />`
- `ProjectsFinancialsTab` → `loading: () => <ProjectsFinancialsSkeleton />`
- `FinancialsInvoicesTab` → `loading: () => <InvoicesTabSkeleton />`
- `FinancialsBankAccountsTab` → `loading: () => <TransactionListSkeleton />`
- `FinancialsTransactionsTab` → `loading: () => <TransactionListSkeleton />`
- `FinancialsExpensesTab` → `loading: () => <TransactionListSkeleton />`

**Step 3: Replace overview tab isLoading spinner (line 99-102)**

Replace:
```tsx
{isLoadingStats ? (
  <div className="flex justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
) : (
```

With:
```tsx
{isLoadingStats ? (
  <FinancialOverviewSkeleton />
) : (
```

**Step 4: Verify Loader2 is no longer imported (unless used elsewhere in file)**

Check that `Loader2` is removed from the lucide-react import. It's only used for loading states in this file.

**Step 5: Commit**

```bash
git add frontend/app/[locale]/(dashboard)/financials/page.tsx
git commit -m "feat: replace financials page spinners with skeletons"
```

---

### Task 3: Replace Approval Dashboard Component Spinners

**Files:**
- Modify: `frontend/components/financials/ExpenseApprovalDashboard.tsx`
- Modify: `frontend/components/financials/BudgetApprovalDashboard.tsx`

**Step 1: Update ExpenseApprovalDashboard**

Replace the `isLoading` early return (lines 32-44) — replace the Loader2 spinner with a skeleton:

```tsx
import { ApprovalCardSkeleton } from '@/components/LoadingSkeletons'

// Replace the isLoading block:
if (isLoading) {
    return <ApprovalCardSkeleton />
}
```

Remove `Loader2` from the lucide-react import ONLY IF it's not used elsewhere in the file (check for mutation button spinners). In this file, Loader2 is not used in buttons, so remove it.

**Step 2: Update BudgetApprovalDashboard**

Same pattern — replace lines 38-50:

```tsx
import { ApprovalCardSkeleton } from '@/components/LoadingSkeletons'

// Replace the isLoading block:
if (isLoading) {
    return <ApprovalCardSkeleton />
}
```

Keep `Loader2` in this file — it's used in approval/reject button spinners (lines 177, 255).

**Step 3: Commit**

```bash
git add frontend/components/financials/ExpenseApprovalDashboard.tsx frontend/components/financials/BudgetApprovalDashboard.tsx
git commit -m "feat: replace approval dashboard spinners with skeletons"
```

---

### Task 4: Add Remaining Skeleton Components

**Files:**
- Modify: `frontend/components/LoadingSkeletons.tsx`

**Step 1: Add BillingHistorySkeleton**

```tsx
export function BillingHistorySkeleton() {
  return (
    <Card className="mt-8">
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Add RefundQueueSkeleton**

```tsx
export function RefundQueueSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex items-center gap-4 border-b px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Add RefundDetailSkeleton**

```tsx
export function RefundDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 4: Add KanbanBoardSkeleton**

```tsx
export function KanbanBoardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 5: Add AssignmentsTableSkeleton**

```tsx
export function AssignmentsTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 border-b pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add frontend/components/LoadingSkeletons.tsx
git commit -m "feat: add remaining skeleton components for all loading states"
```

---

### Task 5: Replace BillingHistory Component Spinner

**Files:**
- Modify: `frontend/components/billing/BillingHistory.tsx`

**Step 1: Replace spinner with skeleton**

Add import:
```tsx
import { BillingHistorySkeleton } from '@/components/LoadingSkeletons'
```

Replace line 80-81:
```tsx
if (isLoading) {
    return <BillingHistorySkeleton />
}
```

Remove `Loader2` from lucide-react import if not used elsewhere in the file.

**Step 2: Commit**

```bash
git add frontend/components/billing/BillingHistory.tsx
git commit -m "feat: replace billing history spinner with skeleton"
```

---

### Task 6: Replace Platform Page Spinners

**Files:**
- Modify: `frontend/app/[locale]/platform/refunds/page.tsx`
- Modify: `frontend/app/[locale]/platform/refunds/[id]/page.tsx`
- Modify: `frontend/app/[locale]/platform/bug-reports/page.tsx`

**Step 1: Update refunds list page (line 55)**

```tsx
import { RefundQueueSkeleton } from '@/components/LoadingSkeletons'

// Replace: if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>
if (isLoading) return <RefundQueueSkeleton />
```

Remove `Loader2` from lucide-react import.

**Step 2: Update refund detail page (line 108)**

```tsx
import { RefundDetailSkeleton } from '@/components/LoadingSkeletons'

// Replace: if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>
if (isLoading) return <RefundDetailSkeleton />
```

Keep `Loader2` — it's used in the processing button spinner.

**Step 3: Update bug reports page (line 24)**

```tsx
import { KanbanBoardSkeleton } from '@/components/LoadingSkeletons'

// Replace: if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>
if (isLoading) return <KanbanBoardSkeleton />
```

Remove `Loader2` from lucide-react import.

**Step 4: Commit**

```bash
git add frontend/app/[locale]/platform/refunds/page.tsx frontend/app/[locale]/platform/refunds/[id]/page.tsx frontend/app/[locale]/platform/bug-reports/page.tsx
git commit -m "feat: replace platform page spinners with skeletons"
```

---

### Task 7: Replace ProjectAssignmentsCard Spinner

**Files:**
- Modify: `frontend/components/projects/ProjectAssignmentsCard.tsx`

**Step 1: Replace content loading spinner (around line 169)**

```tsx
import { AssignmentsTableSkeleton } from '@/components/LoadingSkeletons'
```

Replace the Loader2 spinner in the content section with:
```tsx
<AssignmentsTableSkeleton />
```

Keep `Loader2` if used in the dialog loading section (line 244) — that's an inline small load and can stay.

**Step 2: Commit**

```bash
git add frontend/components/projects/ProjectAssignmentsCard.tsx
git commit -m "feat: replace project assignments spinner with skeleton"
```

---

### Task 8: Handle Platform Layout Auth Spinner

**Files:**
- Modify: `frontend/app/[locale]/platform/layout.tsx`

**Step 1: Replace full-page auth spinner (line 65)**

The platform layout shows a full-screen spinner during auth verification. This is an auth gate — a skeleton of the platform layout is appropriate:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Replace: return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
if (isLoading || isPlatformAdmin === null) {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card px-6 py-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-7 w-36" />
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-6">
                <Skeleton className="h-8 w-48 mb-6" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </main>
        </div>
    )
}
```

Remove `Loader2` from lucide-react import. Keep `ArrowLeft`.

**Step 2: Commit**

```bash
git add frontend/app/[locale]/platform/layout.tsx
git commit -m "feat: replace platform layout auth spinner with skeleton"
```

---

### Task 9: Final Audit & Cleanup

**Step 1: Search for remaining Loader2 content-loading spinners**

Run: `grep -rn "Loader2" frontend/app/ frontend/components/ --include="*.tsx" | grep -v "Button\|disabled\|isPending\|isDeleting\|isProcessing\|isAnalyzing\|isGenerating\|SyncStatus\|sonner\|node_modules"`

Review any remaining instances. If they're mutation/button spinners, leave them. If they're content loading, create a skeleton and replace.

**Step 2: Verify no build errors**

Run: `cd frontend && npm run build`

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final skeleton loading cleanup"
```
