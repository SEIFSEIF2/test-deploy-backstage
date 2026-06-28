'use client'

import {
  CalendarRange,
  CircleDashed,
  FileText,
  Focus,
  Loader2,
  Pencil,
  Play,
  Plus
} from 'lucide-react'
import type { Sprint } from './boardData'
import { useDashTheme } from './theme'

// Hero card that sits above the board when the in-scope project has an
// active sprint. Renamed from "sprint" everywhere in copy; the underlying
// model still uses Sprint / sprintId for backward compatibility.

interface SprintHeroProps {
  sprint: Sprint | null
  canEdit: boolean
  onPlan: () => void
  onEdit: () => void
  copySlot?: React.ReactNode
  // When set, renders a "Focus" toggle that filters the board down to the
  // current sprint's tasks. Driven by DashboardShell's boardSprintLens
  // state so other views (List, Timeline) aren't affected.
  lensActive?: boolean
  onToggleLens?: () => void
  // When provided AND the sprint is upcoming, renders a Start sprint
  // button inline. DashboardShell wires this to the startSprint action.
  onStart?: () => void
  starting?: boolean
}

function daysBetweenToday(iso: string): number {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).getTime()
  const target = new Date(iso + 'T00:00:00Z').getTime()
  return Math.round((target - today) / 86400000)
}

export default function SprintHero({
  sprint,
  canEdit,
  onPlan,
  onEdit,
  copySlot,
  lensActive,
  onToggleLens,
  onStart,
  starting
}: SprintHeroProps) {
  const { t } = useDashTheme()

  if (!sprint) {
    return (
      <div
        className={`mb-2 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 ${t.border}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className={`text-[13px] font-medium ${t.text}`}>
            No active sprint
          </span>
          <span className={`text-[11px] ${t.textMuted}`}>
            Plan a sprint to give this project a focus window and a Definition
            of Done.
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onPlan}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] transition ${t.accent}`}
          >
            <Plus className="size-3" /> Start a sprint
          </button>
        )}
      </div>
    )
  }

  const isUpcoming = sprint.status === 'upcoming'
  const isCompleted = sprint.status === 'completed'
  const badgeLabel = isUpcoming
    ? 'Upcoming sprint'
    : isCompleted
      ? 'Completed sprint'
      : 'Current sprint'
  const BadgeIcon = isUpcoming
    ? CircleDashed
    : isCompleted
      ? CalendarRange
      : Loader2
  const badgeIconClass = !isUpcoming && !isCompleted ? 'animate-spin' : ''

  let leftLabel: string
  let leftClass: string
  if (isUpcoming) {
    const startsIn = daysBetweenToday(sprint.fromIso)
    leftLabel =
      startsIn <= 0
        ? 'Ready to start'
        : startsIn === 1
          ? 'Starts tomorrow'
          : `Starts in ${startsIn}d`
    leftClass = t.textMuted
  } else if (isCompleted) {
    leftLabel = 'Closed'
    leftClass = t.textSubtle
  } else {
    const left = daysBetweenToday(sprint.toIso)
    leftLabel =
      left < 0
        ? `${Math.abs(left)}d overdue`
        : left === 0
          ? 'Ends today'
          : `${left}d left`
    leftClass = left < 0 ? t.accentText : t.textMuted
  }

  return (
    <div
      className={`mb-2 flex flex-col gap-2 rounded-lg border px-3 py-2 ${t.column}`}
    >
      {/* Row 1: identity (left) + actions (right). */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase ${t.metaTag}`}
            >
              <BadgeIcon className={`size-2.5 ${badgeIconClass}`} />
              {badgeLabel}
            </span>
            <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
              #{sprint.number}
            </span>
          </div>
          <h3
            className={`truncate text-[13px] leading-tight font-medium ${t.text}`}
          >
            {sprint.name}
          </h3>
          {sprint.goal && (
            <p
              className={`line-clamp-2 text-[11px] leading-snug ${t.textMuted}`}
            >
              {sprint.goal}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {sprint.docUrl && (
            <a
              href={sprint.docUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="Open plan doc"
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${t.btn}`}
            >
              <FileText className="size-3" />
              <span className="hidden sm:inline">Doc</span>
            </a>
          )}
          {copySlot}
          {isUpcoming && onStart && canEdit && (
            <button
              onClick={onStart}
              disabled={starting}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition disabled:opacity-50 ${t.accent}`}
            >
              {starting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              <span className="hidden sm:inline">
                {starting ? 'Starting...' : 'Start sprint'}
              </span>
            </button>
          )}
          {onToggleLens && (
            <button
              onClick={onToggleLens}
              title={
                lensActive
                  ? 'Show all tasks'
                  : "Focus the board on this sprint's tasks"
              }
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${
                lensActive ? t.tabActive : t.btn
              }`}
            >
              <Focus className="size-3" />
              <span className="hidden sm:inline">
                {lensActive ? 'Showing this sprint' : 'Focus sprint'}
              </span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={onEdit}
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${t.btn}`}
            >
              <Pencil className="size-3" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: meta strip — dates, days-left, progress count, percent. */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t pt-1.5 text-[10px] ${t.border}`}
      >
        <span className={`inline-flex items-center gap-1 ${t.textMuted}`}>
          <CalendarRange className="size-2.5" />
          {sprint.from} → {sprint.to}
        </span>
        <span className={leftClass}>{leftLabel}</span>
        <span className={`tabular-nums ${t.textMuted}`}>
          {sprint.completedCount}/{sprint.scope || 0} done
        </span>
        <span className={`ml-auto tabular-nums ${t.textSubtle}`}>
          {sprint.percent}%
        </span>
      </div>

      {/* Row 3: progress bar */}
      <div className={`h-1 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${sprint.percent}%` }}
        />
      </div>
    </div>
  )
}
