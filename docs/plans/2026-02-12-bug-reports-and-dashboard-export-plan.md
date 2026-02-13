# Bug Reports & Dashboard Export — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two non-functional dashboard buttons with a bug report modal and export menu, and add a Kanban board to the superadmin platform for managing bug reports.

**Architecture:** New `BugReport` model with user-facing and platform-admin API endpoints following the existing refunds pattern. Client-side CSV/PDF export from already-loaded dashboard data. Kanban board with `@dnd-kit` for drag-and-drop status changes.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js + React + @dnd-kit + jspdf (frontend), next-intl (i18n)

---

### Task 1: Backend — BugReport Model

**Files:**
- Create: `backend/app/models/bug_reports.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the BugReport model**

Create `backend/app/models/bug_reports.py`:

```python
from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class BugReport(Base):
    __tablename__ = "bug_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    reporter_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)

    title = Column(String, nullable=False)
    category = Column(String, nullable=False)  # bug, feature_request, other
    description = Column(Text, nullable=False)

    status = Column(String, default="open", nullable=False, index=True)
    # open, in_review, resolved, closed

    admin_notes = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
```

**Step 2: Register model in `__init__.py`**

In `backend/app/models/__init__.py`, add:
- Import: `from .bug_reports import BugReport`
- Add `"BugReport"` to `__all__`

**Step 3: Generate Alembic migration**

Run: `cd backend && alembic revision --autogenerate -m "Add bug_reports table"`

**Step 4: Apply migration**

Run: `cd backend && alembic upgrade head`

**Step 5: Commit**

```bash
git add backend/app/models/bug_reports.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: add BugReport model and migration"
```

---

### Task 2: Backend — Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/bug_reports.py`

**Step 1: Create schemas**

Create `backend/app/schemas/bug_reports.py`:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class BugReportCreate(BaseModel):
    title: str
    category: str  # bug, feature_request, other
    description: str


class BugReportResponse(BaseModel):
    id: UUID
    organization_id: UUID
    reporter_profile_id: UUID
    title: str
    category: str
    description: str
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlatformBugReportUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
```

**Step 2: Commit**

```bash
git add backend/app/schemas/bug_reports.py
git commit -m "feat: add BugReport pydantic schemas"
```

---

### Task 3: Backend — User-Facing API Endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/bug_reports.py`
- Modify: `backend/app/api/v1/api.py` (lines 3-11 imports, after line 207)

**Step 1: Create user-facing endpoints**

Create `backend/app/api/v1/endpoints/bug_reports.py`:

```python
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_profile
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.bug_reports import BugReport
from app.schemas.bug_reports import BugReportCreate, BugReportResponse

router = APIRouter()


@router.post("/", response_model=BugReportResponse)
async def create_bug_report(
    *,
    db: AsyncSession = Depends(get_db),
    params: BugReportCreate,
    current_user: Profile = Depends(get_current_profile),
) -> Any:
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in organization")

    report = BugReport(
        organization_id=current_user.organization_id,
        reporter_profile_id=current_user.id,
        title=params.title,
        category=params.category,
        description=params.description,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/", response_model=List[BugReportResponse])
async def list_bug_reports(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Profile = Depends(get_current_profile),
) -> Any:
    query = (
        select(BugReport)
        .where(BugReport.organization_id == current_user.organization_id)
        .offset(skip)
        .limit(limit)
        .order_by(BugReport.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()
```

**Step 2: Register route in `api.py`**

In `backend/app/api/v1/api.py`:
- Add `bug_reports` to the import block (line 10, after `refunds, platform_refunds,`)
- Add after line 207:
```python
api_router.include_router(
    bug_reports.router,
    prefix="/bug-reports",
    tags=["bug_reports"]
)
```

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/bug_reports.py backend/app/api/v1/api.py
git commit -m "feat: add user-facing bug report API endpoints"
```

---

### Task 4: Backend — Platform Admin API Endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/platform_bug_reports.py`
- Modify: `backend/app/api/v1/api.py`

**Step 1: Create platform admin endpoints**

Create `backend/app/api/v1/endpoints/platform_bug_reports.py`:

```python
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.api.deps import require_platform_admin
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.bug_reports import BugReport
from app.schemas.bug_reports import BugReportResponse, PlatformBugReportUpdate

router = APIRouter()


@router.get("/", response_model=List[BugReportResponse])
async def list_all_bug_reports(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).order_by(BugReport.created_at.desc())

    if status:
        query = query.where(BugReport.status == status)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{id}", response_model=BugReportResponse)
async def get_bug_report_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).where(BugReport.id == id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


@router.patch("/{id}", response_model=BugReportResponse)
async def update_bug_report(
    id: UUID,
    update: PlatformBugReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).where(BugReport.id == id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if update.status is not None:
        report.status = update.status
    if update.admin_notes is not None:
        report.admin_notes = update.admin_notes

    await db.commit()
    await db.refresh(report)
    return report
```

**Step 2: Register route in `api.py`**

In `backend/app/api/v1/api.py`:
- Add `platform_bug_reports` to the import block
- Add after the bug_reports router:
```python
api_router.include_router(
    platform_bug_reports.router,
    prefix="/platform/bug-reports",
    tags=["platform_bug_reports"]
)
```

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/platform_bug_reports.py backend/app/api/v1/api.py
git commit -m "feat: add platform admin bug report API endpoints"
```

---

### Task 5: Frontend — Install Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install packages**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities jspdf jspdf-autotable
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @dnd-kit and jspdf dependencies"
```

---

### Task 6: Frontend — i18n Translation Keys

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/pt-br.json`

**Step 1: Add English translations**

Add under the `"dashboard"` key in `en.json`:

```json
"bugReport": "Report Bug",
"exportData": "Export",
"exportCSV": "Export as CSV",
"exportPDF": "Export as PDF",
"bugReportModal": {
  "title": "Report a Bug",
  "description": "Help us improve SafeTasks by reporting issues you encounter.",
  "fields": {
    "titleLabel": "Title",
    "titlePlaceholder": "Brief description of the issue",
    "categoryLabel": "Category",
    "categoryPlaceholder": "Select a category",
    "categoryOptions": {
      "bug": "Bug",
      "featureRequest": "Feature Request",
      "other": "Other"
    },
    "descriptionLabel": "Description",
    "descriptionPlaceholder": "Describe the issue in detail..."
  },
  "actions": {
    "submit": "Submit Report",
    "cancel": "Cancel"
  },
  "messages": {
    "requiredFields": "Please fill in all required fields",
    "submitSuccess": "Report submitted successfully!",
    "submitError": "Failed to submit report"
  }
}
```

Add a new top-level `"platform"` key (or extend if exists):

```json
"platform": {
  "bugReports": {
    "title": "Bug Reports",
    "columns": {
      "open": "Open",
      "in_review": "In Review",
      "resolved": "Resolved",
      "closed": "Closed"
    },
    "card": {
      "bug": "Bug",
      "featureRequest": "Feature Request",
      "other": "Other"
    },
    "detail": {
      "title": "Bug Report Details",
      "reporter": "Reporter",
      "organization": "Organization",
      "category": "Category",
      "status": "Status",
      "description": "Description",
      "adminNotes": "Admin Notes",
      "adminNotesPlaceholder": "Add internal notes...",
      "save": "Save Notes",
      "back": "Back to Board",
      "saved": "Notes saved",
      "saveFailed": "Failed to save notes"
    }
  }
}
```

**Step 2: Add Portuguese (Brazil) translations**

Add equivalent keys in `pt-br.json`:

```json
"bugReport": "Reportar Bug",
"exportData": "Exportar",
"exportCSV": "Exportar como CSV",
"exportPDF": "Exportar como PDF",
"bugReportModal": {
  "title": "Reportar um Bug",
  "description": "Nos ajude a melhorar o SafeTasks reportando problemas encontrados.",
  "fields": {
    "titleLabel": "Titulo",
    "titlePlaceholder": "Breve descricao do problema",
    "categoryLabel": "Categoria",
    "categoryPlaceholder": "Selecione uma categoria",
    "categoryOptions": {
      "bug": "Bug",
      "featureRequest": "Sugestao de Funcionalidade",
      "other": "Outro"
    },
    "descriptionLabel": "Descricao",
    "descriptionPlaceholder": "Descreva o problema em detalhes..."
  },
  "actions": {
    "submit": "Enviar Relatorio",
    "cancel": "Cancelar"
  },
  "messages": {
    "requiredFields": "Por favor, preencha todos os campos obrigatorios",
    "submitSuccess": "Relatorio enviado com sucesso!",
    "submitError": "Falha ao enviar relatorio"
  }
}
```

Platform section in `pt-br.json`:

```json
"platform": {
  "bugReports": {
    "title": "Relatorios de Bug",
    "columns": {
      "open": "Aberto",
      "in_review": "Em Analise",
      "resolved": "Resolvido",
      "closed": "Fechado"
    },
    "card": {
      "bug": "Bug",
      "featureRequest": "Sugestao",
      "other": "Outro"
    },
    "detail": {
      "title": "Detalhes do Relatorio",
      "reporter": "Relator",
      "organization": "Organizacao",
      "category": "Categoria",
      "status": "Status",
      "description": "Descricao",
      "adminNotes": "Notas do Admin",
      "adminNotesPlaceholder": "Adicionar notas internas...",
      "save": "Salvar Notas",
      "back": "Voltar ao Quadro",
      "saved": "Notas salvas",
      "saveFailed": "Falha ao salvar notas"
    }
  }
}
```

**Step 3: Commit**

```bash
git add frontend/messages/en.json frontend/messages/pt-br.json
git commit -m "feat: add i18n keys for bug reports and dashboard export"
```

---

### Task 7: Frontend — BugReportModal Component

**Files:**
- Create: `frontend/components/dashboard/BugReportModal.tsx`

**Step 1: Create the modal component**

Create `frontend/components/dashboard/BugReportModal.tsx` following the RefundRequestModal pattern. The modal includes:
- Title input
- Category select (bug, feature_request, other)
- Description textarea
- Submit calls `POST /api/v1/bug-reports/`
- Uses `useTranslations('dashboard.bugReportModal')`
- Uses `toast` from `sonner` for success/error feedback
- Loading state with `Loader2` spinner

Reference `frontend/components/billing/RefundRequestModal.tsx` for the exact pattern (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Label, etc.).

**Step 2: Commit**

```bash
git add frontend/components/dashboard/BugReportModal.tsx
git commit -m "feat: add BugReportModal component"
```

---

### Task 8: Frontend — ExportMenu Component

**Files:**
- Create: `frontend/components/dashboard/ExportMenu.tsx`

**Step 1: Create export menu component**

Create `frontend/components/dashboard/ExportMenu.tsx`:
- A `DropdownMenu` (from `@radix-ui/react-dropdown-menu` or the project's `ui/dropdown-menu`) triggered by the Export button
- Two items: "Export as CSV" and "Export as PDF"
- CSV: builds a CSV string from the dashboard data object and triggers a download via `Blob` + `URL.createObjectURL`
- PDF: uses `jspdf` + `jspdf-autotable` to create a formatted PDF with sections for financial, production, inventory metrics
- Props: `data` (the executive dashboard response object)
- Uses `useTranslations('dashboard')` for labels

**Step 2: Commit**

```bash
git add frontend/components/dashboard/ExportMenu.tsx
git commit -m "feat: add ExportMenu component with CSV and PDF support"
```

---

### Task 9: Frontend — Wire Up Dashboard Buttons

**Files:**
- Modify: `frontend/app/[locale]/(dashboard)/dashboard/page.tsx` (lines 126-129)

**Step 1: Import and wire up components**

In `dashboard/page.tsx`:
- Add imports for `BugReportModal` and `ExportMenu`
- Add `useState` for `isBugReportOpen`
- Replace lines 126-129:

Before:
```tsx
<div className="flex gap-2">
  <Button variant="outline">Export</Button>
  <Button>Create report</Button>
</div>
```

After:
```tsx
<div className="flex gap-2">
  <ExportMenu data={dashboard} />
  <Button onClick={() => setIsBugReportOpen(true)}>{t('bugReport')}</Button>
</div>
<BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />
```

**Step 2: Commit**

```bash
git add frontend/app/[locale]/(dashboard)/dashboard/page.tsx
git commit -m "feat: wire up export menu and bug report modal to dashboard"
```

---

### Task 10: Frontend — Platform Layout Navigation

**Files:**
- Modify: `frontend/app/[locale]/platform/layout.tsx` (line 64-66)

**Step 1: Add Bug Reports nav link**

In `platform/layout.tsx`, after the existing "Refunds Queue" link (line 64-66), add:

```tsx
<Link href={`/${locale}/platform/bug-reports`} className="hover:text-primary">
    Bug Reports
</Link>
```

**Step 2: Commit**

```bash
git add frontend/app/[locale]/platform/layout.tsx
git commit -m "feat: add bug reports link to platform admin nav"
```

---

### Task 11: Frontend — API Hook for Bug Reports

**Files:**
- Create: `frontend/lib/api/hooks/useBugReports.ts`

**Step 1: Create the hook**

Create `frontend/lib/api/hooks/useBugReports.ts` with:
- `BugReport` interface matching `BugReportResponse` schema
- `usePlatformBugReports()` — fetches all reports from `/api/v1/platform/bug-reports/`
- `useUpdateBugReport()` — mutation to `PATCH /api/v1/platform/bug-reports/{id}` with query invalidation
- Follow the pattern in `frontend/lib/api/hooks/useNotifications.ts`

**Step 2: Commit**

```bash
git add frontend/lib/api/hooks/useBugReports.ts
git commit -m "feat: add useBugReports API hook"
```

---

### Task 12: Frontend — Kanban Board Component

**Files:**
- Create: `frontend/components/platform/KanbanBoard.tsx`

**Step 1: Create the Kanban board component**

Create `frontend/components/platform/KanbanBoard.tsx`:
- Uses `@dnd-kit/core` (`DndContext`, `DragOverlay`, `closestCorners`) and `@dnd-kit/sortable` (`SortableContext`)
- Props: `reports: BugReport[]`, `onStatusChange: (id: string, newStatus: string) => void`
- 4 columns: `open`, `in_review`, `resolved`, `closed`
- Each column is a droppable area with cards filtered by status
- Each card: `SortableItem` showing title, category badge, time ago
- Cards are clickable (link to detail page)
- `onDragEnd`: determines new column from `over.id`, calls `onStatusChange`
- Uses `useTranslations('platform.bugReports')` for column headers and category labels
- Category badge colors: bug=red, feature_request=blue, other=gray

**Step 2: Commit**

```bash
git add frontend/components/platform/KanbanBoard.tsx
git commit -m "feat: add KanbanBoard component with drag-and-drop"
```

---

### Task 13: Frontend — Bug Reports Kanban Page

**Files:**
- Create: `frontend/app/[locale]/platform/bug-reports/page.tsx`

**Step 1: Create the page**

Create `frontend/app/[locale]/platform/bug-reports/page.tsx`:
- Uses `usePlatformBugReports()` to fetch all reports
- Uses `useUpdateBugReport()` for status changes
- Renders `<KanbanBoard reports={reports} onStatusChange={handleStatusChange} />`
- `handleStatusChange` calls the mutation and shows toast on success/failure
- Loading state with `Loader2`

**Step 2: Commit**

```bash
git add frontend/app/[locale]/platform/bug-reports/page.tsx
git commit -m "feat: add platform bug reports kanban page"
```

---

### Task 14: Frontend — Bug Report Detail Page

**Files:**
- Create: `frontend/app/[locale]/platform/bug-reports/[id]/page.tsx`

**Step 1: Create the detail page**

Create `frontend/app/[locale]/platform/bug-reports/[id]/page.tsx`:
- Fetches single report from `/api/v1/platform/bug-reports/{id}` using `apiClient.get`
- Displays: title, category badge, status badge, description, reporter ID, organization ID, created_at, updated_at
- Admin notes: editable `Textarea` with a "Save Notes" button
- Save calls `PATCH /api/v1/platform/bug-reports/{id}` with `{ admin_notes }`
- "Back to Board" link
- Uses `useTranslations('platform.bugReports.detail')`

**Step 2: Commit**

```bash
git add "frontend/app/[locale]/platform/bug-reports/[id]/page.tsx"
git commit -m "feat: add platform bug report detail page with admin notes"
```

---

### Task 15: Final Verification

**Step 1: Verify backend starts**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

Check: `GET /docs` shows new endpoints

**Step 2: Verify frontend builds**

```bash
cd frontend && npm run build
```

Expected: No build errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: address build issues"
```
