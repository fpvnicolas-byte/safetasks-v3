# Bug Reports & Dashboard Export

## Overview

Two changes to the user dashboard and one new feature for the superadmin platform:

1. **"Create report" button** becomes a bug report submission form (modal) that sends structured reports to superadmins.
2. **"Export" button** becomes a working export with CSV and PDF options using the already-loaded dashboard data.
3. **Platform gets a Kanban board** at `/platform/bug-reports/` for superadmins to triage and manage reports.

## Bug Report Data Model

### `bug_reports` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK to organizations, NOT NULL |
| reporter_profile_id | UUID | FK to profiles, NOT NULL |
| title | String | NOT NULL |
| category | String | `bug`, `feature_request`, `other` — NOT NULL |
| description | Text | NOT NULL |
| status | String | `open`, `in_review`, `resolved`, `closed` — default `open` |
| admin_notes | Text | Nullable, for superadmin internal notes |
| created_at | Timestamp | server_default=now() |
| updated_at | Timestamp | server_default=now(), onupdate=now() |

## API Endpoints

### User-facing

- `POST /api/v1/bug-reports/` — Submit a report (auth required, org-scoped)
- `GET /api/v1/bug-reports/` — List own org's reports

### Platform (superadmin)

- `GET /api/v1/platform/bug-reports/` — List all reports (supports `?status=` filter)
- `PATCH /api/v1/platform/bug-reports/{id}` — Update status and/or admin_notes

## User Dashboard Changes

### Bug Report Modal

Triggered by the "Report Bug" button (replaces "Create report"). Opens a modal with:
- Title input
- Category dropdown: Bug, Feature Request, Other
- Description textarea
- Submit button

Follows the existing `RefundRequestModal` pattern.

### Export Menu

Triggered by the "Export" button. Opens a dropdown with:
- "Export as CSV" — generates CSV from dashboard metrics
- "Export as PDF" — generates PDF with `jspdf` + `jspdf-autotable`

Both use data already loaded from `/api/v1/dashboard/executive`. No new backend endpoints.

## Platform Kanban Board

### Page: `/platform/bug-reports/`

Four columns: **Open**, **In Review**, **Resolved**, **Closed**.

Each card shows: title, category badge, reporter org, time ago.

Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`. Dragging between columns triggers `PATCH` to update status. Cards sorted by newest first within columns (no within-column reordering).

### Detail Page: `/platform/bug-reports/[id]`

Full report info (title, category, description, reporter, org, timestamps) plus editable admin notes textarea.

### Navigation

"Bug Reports" link added to platform layout header alongside "Refunds Queue".

## New Dependencies

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `jspdf`, `jspdf-autotable`

## File Changes

### New backend files
- `backend/app/models/bug_reports.py`
- `backend/app/schemas/bug_reports.py`
- `backend/app/api/v1/endpoints/bug_reports.py`
- `backend/app/api/v1/endpoints/platform_bug_reports.py`
- Alembic migration

### New frontend files
- `frontend/components/dashboard/BugReportModal.tsx`
- `frontend/components/dashboard/ExportMenu.tsx`
- `frontend/app/[locale]/platform/bug-reports/page.tsx`
- `frontend/app/[locale]/platform/bug-reports/[id]/page.tsx`
- `frontend/components/platform/KanbanBoard.tsx`

### Modified files
- `frontend/app/[locale]/(dashboard)/dashboard/page.tsx` — wire up buttons
- `frontend/app/[locale]/platform/layout.tsx` — add nav link
- `frontend/messages/en.json` + `pt-br.json` — new i18n keys
- `backend/app/models/__init__.py` — register BugReport
- `backend/app/api/v1/router.py` — register new endpoints
