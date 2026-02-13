'use client'

import { useState } from 'react'
import Link from 'next/link'
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
}: {
  report: BugReport
  t: ReturnType<typeof useTranslations>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link href={`/platform/bug-reports/${report.id}`}>
        <Card className="cursor-grab gap-2 p-3 shadow-sm hover:shadow-md transition-shadow">
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
      </Link>
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
// DroppableColumn
// ---------------------------------------------------------------------------

function DroppableColumn({
  status,
  reports,
  t,
}: {
  status: string
  reports: BugReport[]
  t: ReturnType<typeof useTranslations>
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
            <SortableCard key={report.id} report={report} t={t} />
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
          />
        ))}
      </div>

      <DragOverlay>
        {activeReport ? <OverlayCard report={activeReport} t={t} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
