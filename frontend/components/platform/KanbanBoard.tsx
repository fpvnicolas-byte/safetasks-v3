'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { type BugReport } from '@/lib/api/hooks/useBugReports'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GripVertical, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  reports: BugReport[]
  onStatusChange: (id: string, newStatus: string) => void
}

const COLUMNS = ['open', 'in_review', 'resolved', 'closed'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffHours < 1) return `${Math.max(diffMin, 1)} min ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${diffDays} days ago`
}

function categoryVariant(category: string) {
  switch (category) {
    case 'bug':
      return 'destructive' as const
    case 'feature_request':
      return 'info' as const
    default:
      return 'secondary' as const
  }
}

function statusVariant(status: string) {
  switch (status) {
    case 'open':
      return 'default' as const
    case 'in_review':
      return 'warning' as const
    case 'resolved':
      return 'success' as const
    case 'closed':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

function categoryLabel(
  category: string,
  t: ReturnType<typeof useTranslations>,
) {
  switch (category) {
    case 'bug':
      return t('card.bug')
    case 'feature_request':
      return t('card.featureRequest')
    default:
      return t('card.other')
  }
}

// ---------------------------------------------------------------------------
// SortableCard
// ---------------------------------------------------------------------------

function SortableCard({
  report,
  t,
  onClick,
}: {
  report: BugReport
  t: ReturnType<typeof useTranslations>
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: report.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="gap-2 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug line-clamp-2">
              {report.title}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <Badge variant={categoryVariant(report.category)}>
                {categoryLabel(report.category, t)}
              </Badge>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(report.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OverlayCard (shown during drag)
// ---------------------------------------------------------------------------

function OverlayCard({
  report,
  t,
}: {
  report: BugReport
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Card className="w-[260px] gap-2 p-3 shadow-lg">
      <p className="text-sm font-medium leading-snug line-clamp-2">
        {report.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={categoryVariant(report.category)}>
          {categoryLabel(report.category, t)}
        </Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {timeAgo(report.created_at)}
        </span>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ReportDetailDialog
// ---------------------------------------------------------------------------

function ReportDetailDialog({
  report,
  isOpen,
  onClose,
  t,
}: {
  report: BugReport | null
  isOpen: boolean
  onClose: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const [adminNotes, setAdminNotes] = useState(report?.admin_notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  // Sync state when report changes
  useEffect(() => {
    setAdminNotes(report?.admin_notes ?? '')
  }, [report?.id, report?.admin_notes])

  if (!report) return null

  const handleSaveNotes = async () => {
    try {
      setIsSaving(true)
      await apiClient.patch(`/api/v1/platform/bug-reports/${report.id}`, { admin_notes: adminNotes })
      toast.success(t('detail.saved'))
    } catch {
      toast.error(t('detail.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{report.title}</DialogTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant={categoryVariant(report.category)}>
              {categoryLabel(report.category, t)}
            </Badge>
            <Badge variant={statusVariant(report.status)}>
              {t(`columns.${report.status}` as Parameters<typeof t>[0])}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-muted-foreground">{t('detail.description')}</Label>
            <p className="mt-1 whitespace-pre-wrap text-sm">{report.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">{t('detail.reporter')}</Label>
              <p className="mt-1 text-xs font-mono">{report.reporter_profile_id}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('detail.organization')}</Label>
              <p className="mt-1 text-xs font-mono">{report.organization_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="mt-1 text-sm">{new Date(report.created_at).toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Updated</Label>
              <p className="mt-1 text-sm">{new Date(report.updated_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-muted-foreground">{t('detail.adminNotes')}</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder={t('detail.adminNotesPlaceholder')}
              className="mt-1"
            />
            <Button onClick={handleSaveNotes} disabled={isSaving} className="mt-2" size="sm">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('detail.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// DroppableColumn
// ---------------------------------------------------------------------------

function DroppableColumn({
  status,
  reports,
  t,
  onCardClick,
}: {
  status: string
  reports: BugReport[]
  t: ReturnType<typeof useTranslations>
  onCardClick: (report: BugReport) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` })

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] flex-1 rounded-lg border bg-muted/50 p-3 transition-colors ${
        isOver ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t(`columns.${status}` as Parameters<typeof t>[0])}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {reports.length}
        </Badge>
      </div>

      {/* Cards */}
      <SortableContext
        items={reports.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {reports.map((report) => (
            <SortableCard
              key={report.id}
              report={report}
              t={t}
              onClick={() => onCardClick(report)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

export default function KanbanBoard({
  reports,
  onStatusChange,
}: KanbanBoardProps) {
  const t = useTranslations('platform.bugReports')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null)

  // Group reports by status and sort newest-first
  const grouped = COLUMNS.reduce(
    (acc, col) => {
      acc[col] = reports
        .filter((r) => r.status === col)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
      return acc
    },
    {} as Record<string, BugReport[]>,
  )

  const activeReport = activeId
    ? reports.find((r) => r.id === activeId) ?? null
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(_event: DragOverEvent) {
    // Could be used for live reorder previews; not needed for column moves.
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)

    const { active, over } = event
    if (!over) return

    const overId = String(over.id)

    // Determine target column from the droppable id
    let targetStatus: string | null = null
    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '')
    } else {
      // Dropped over another card — find which column that card belongs to
      const overReport = reports.find((r) => r.id === overId)
      if (overReport) targetStatus = overReport.status
    }

    if (!targetStatus) return

    const draggedReport = reports.find((r) => r.id === String(active.id))
    if (!draggedReport) return

    if (draggedReport.status !== targetStatus) {
      onStatusChange(String(active.id), targetStatus)
    }
  }

  return (
    <>
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              reports={grouped[status]}
              t={t}
              onCardClick={setSelectedReport}
            />
          ))}
        </div>

        <DragOverlay>
          {activeReport ? <OverlayCard report={activeReport} t={t} /> : null}
        </DragOverlay>
      </DndContext>

      <ReportDetailDialog
        report={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        t={t}
      />
    </>
  )
}
