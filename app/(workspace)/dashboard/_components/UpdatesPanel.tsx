'use client'

import { useMemo, useState } from 'react'
import {
  AlarmClock,
  Bell,
  CalendarDays,
  CalendarRange,
  Flag,
  MessageSquare,
  MoveRight,
  Paperclip,
  Search,
  Sparkles,
  Trash2,
  UserCog
} from 'lucide-react'
import { CopyButton, CopyMenuItem } from '@/components/ui/copy-button'
import { updatesToJson, updatesToMarkdown } from '@/lib/export/updates'
import { isInScope, TimeScope } from '@/lib/export/timeRange'
import { useDashTheme } from './theme'

type UpdateKind =
  | 'status'
  | 'comment'
  | 'attachment'
  | 'created'
  | 'priority'
  | 'assignee'
  | 'team'
  | 'meeting'
  | 'task-deletion'
  | 'sprint'
  | 'due-soon'

interface UpdateRow {
  id: string
  kind: UpdateKind
  text: string
  at: string
  atRaw: string
  // taskId is nullable now because team-management rows don't tie to
  // a task. The renderer hides the "jump to task" affordance when null.
  taskId: string | null
  taskRef: string | null
  taskTitle: string | null
  // Populated for meeting rows; click opens the inbox sheet focused on
  // this meeting. Null for everything else.
  meetingId: string | null
  // Activity-log action string for meeting rows ("meeting.reviewed",
  // "meeting.requested", ...). Drives where the click routes: reviewed
  // meetings open the share page (which has the recap), everything
  // else falls back to the inbox sheet.
  meetingAction?: string | null
  // For room.invite team rows: Meet URL captured from the activity's
  // metadata, opened in a new tab on click.
  meetUrl?: string | null
}

type UpdateFilter =
  | 'all'
  | 'comment'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'team'
  | 'meeting'
  | 'sprint'

const FILTERS: { id: UpdateFilter; label: string; match: UpdateKind[] }[] = [
  { id: 'all', label: 'All', match: [] },
  { id: 'comment', label: 'Comments', match: ['comment'] },
  { id: 'status', label: 'Status', match: ['status', 'created'] },
  { id: 'priority', label: 'Priority', match: ['priority'] },
  { id: 'assignee', label: 'Assignees', match: ['assignee'] },
  { id: 'team', label: 'Team', match: ['team'] },
  { id: 'meeting', label: 'Meetings', match: ['meeting'] },
  { id: 'sprint', label: 'Sprints', match: ['sprint'] }
]

function kindIcon(kind: UpdateKind) {
  switch (kind) {
    case 'comment':
      return MessageSquare
    case 'priority':
      return Flag
    case 'assignee':
      return UserCog
    case 'attachment':
      return Paperclip
    case 'created':
      return Sparkles
    case 'team':
      return UserCog
    case 'meeting':
      return CalendarDays
    case 'task-deletion':
      return Trash2
    case 'sprint':
      return CalendarRange
    case 'due-soon':
      return AlarmClock
    case 'status':
    default:
      return MoveRight
  }
}

function kindTone(kind: UpdateKind, mode: 'light' | 'dark') {
  if (mode === 'light') {
    switch (kind) {
      case 'comment':
        return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'priority':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'assignee':
        return 'bg-violet-100 text-violet-700 border-violet-200'
      case 'attachment':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200'
      case 'created':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'team':
        return 'bg-teal-100 text-teal-700 border-teal-200'
      case 'meeting':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'task-deletion':
        return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'sprint':
        return 'bg-teal-100 text-teal-700 border-teal-200'
      case 'due-soon':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'status':
      default:
        return 'bg-rose-100 text-rose-700 border-rose-200'
    }
  }
  switch (kind) {
    case 'comment':
      return 'bg-sky-400/10 text-sky-300 border-sky-400/30'
    case 'priority':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/30'
    case 'assignee':
      return 'bg-violet-400/10 text-violet-300 border-violet-400/30'
    case 'attachment':
      return 'bg-white/5 text-white/70 border-white/20'
    case 'created':
      return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
    case 'team':
      return 'bg-teal-400/10 text-teal-300 border-teal-400/30'
    case 'meeting':
      return 'bg-indigo-400/10 text-indigo-300 border-indigo-400/30'
    case 'task-deletion':
      return 'bg-rose-400/10 text-rose-300 border-rose-400/30'
    case 'sprint':
      return 'bg-teal-400/10 text-teal-300 border-teal-400/30'
    case 'due-soon':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/30'
    case 'status':
    default:
      return 'bg-rose-400/10 text-rose-300 border-rose-400/30'
  }
}

function bucketFor(
  iso: string,
  now: Date
): 'today' | 'yesterday' | 'week' | 'earlier' {
  const d = new Date(iso)
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const today = startOfDay(now)
  const day = startOfDay(d)
  const diffDays = Math.round((today - day) / 86400000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays <= 6) return 'week'
  return 'earlier'
}

const BUCKETS: {
  id: 'today' | 'yesterday' | 'week' | 'earlier'
  label: string
}[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'earlier', label: 'Earlier' }
]

function scopedUpdates(
  rows: UpdateRow[],
  scope: Exclude<TimeScope, 'all' | 'sprint'>
): UpdateRow[] {
  const now = new Date()
  return rows.filter((row) => isInScope(row.atRaw, scope, now))
}

function buildUpdatesCopyMenu(args: {
  allActivity: UpdateRow[]
  filteredActivity: UpdateRow[]
  filterLabel?: string
}): CopyMenuItem[] {
  const meta = (label?: string) => ({
    title: 'Updates',
    scopeLabel: label
  })
  return [
    {
      id: 'md-current',
      label: 'Copy as Markdown',
      description: 'Honors current filter + search',
      getContent: () =>
        updatesToMarkdown(args.filteredActivity, meta(args.filterLabel)),
      toastLabel: 'updates as Markdown'
    },
    {
      id: 'json-current',
      label: 'Copy as JSON',
      description: 'Versioned shape for agent ingestion',
      getContent: () =>
        updatesToJson(args.filteredActivity, meta(args.filterLabel)),
      toastLabel: 'updates as JSON'
    },
    {
      id: 'today',
      label: 'Copy today (Markdown)',
      description: 'Updates since midnight',
      separatorBefore: true,
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'today'),
          meta('today')
        ),
      toastLabel: "today's updates"
    },
    {
      id: 'week',
      label: 'Copy this week (Markdown)',
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'week'),
          meta('this week')
        ),
      toastLabel: "this week's updates"
    },
    {
      id: 'month',
      label: 'Copy this month (Markdown)',
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'month'),
          meta('this month')
        ),
      toastLabel: "this month's updates"
    },
    {
      id: 'all',
      label: 'Copy all (Markdown)',
      getContent: () => updatesToMarkdown(args.allActivity, meta('all')),
      toastLabel: 'all updates'
    }
  ]
}

export function UpdatesPanel({
  activity,
  onOpenTask,
  onOpenMeeting
}: {
  activity: UpdateRow[]
  onOpenTask: (taskId: string) => void
  onOpenMeeting: (meetingId: string) => void
}) {
  const { t, mode } = useDashTheme()
  const [filter, setFilter] = useState<UpdateFilter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<UpdateFilter, number> = {
      all: activity.length,
      comment: 0,
      status: 0,
      priority: 0,
      assignee: 0,
      team: 0,
      meeting: 0,
      sprint: 0
    }
    for (const a of activity) {
      if (a.kind === 'comment') c.comment++
      else if (a.kind === 'status' || a.kind === 'created') c.status++
      else if (a.kind === 'priority') c.priority++
      else if (a.kind === 'assignee') c.assignee++
      else if (a.kind === 'team') c.team++
      else if (a.kind === 'meeting') c.meeting++
      else if (a.kind === 'sprint') c.sprint++
    }
    return c
  }, [activity])

  const filtered = useMemo(() => {
    const match = FILTERS.find((f) => f.id === filter)?.match ?? []
    const q = query.trim().toLowerCase()
    return activity.filter((a) => {
      if (match.length > 0 && !match.includes(a.kind)) return false
      if (!q) return true
      const hay = [a.text, a.taskRef ?? '', a.taskTitle ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activity, filter, query])

  const grouped = useMemo(() => {
    const now = new Date()
    const out: Record<'today' | 'yesterday' | 'week' | 'earlier', UpdateRow[]> =
      {
        today: [],
        yesterday: [],
        week: [],
        earlier: []
      }
    for (const a of filtered) out[bucketFor(a.atRaw, now)].push(a)
    return out
  }, [filtered])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-8">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className={`text-2xl font-medium ${t.text}`}>Updates</h2>
            <p className={`mt-1 text-sm ${t.textMuted}`}>
              Everything that&apos;s happened across your tasks comments, status
              moves, priority shifts and reassignments. Click any row to jump to
              its task.
            </p>
          </div>
          {activity.length > 0 && (
            <CopyButton
              primaryLabel="Copy updates"
              primaryToastLabel="updates as Markdown"
              primaryGetContent={() =>
                updatesToMarkdown(filtered, {
                  title: 'Updates',
                  scopeLabel: filter === 'all' ? undefined : `Filter: ${filter}`
                })
              }
              menu={buildUpdatesCopyMenu({
                allActivity: activity,
                filteredActivity: filtered,
                filterLabel: filter === 'all' ? undefined : `Filter: ${filter}`
              })}
            />
          )}
        </header>

        {activity.length === 0 ? (
          <div
            className={`flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center ${t.border}`}
          >
            <span
              className={`flex size-12 items-center justify-center rounded-full border ${t.border} ${t.surfaceMuted}`}
            >
              <Bell className={`size-5 ${t.textSubtle}`} />
            </span>
            <h3 className={`text-sm font-medium ${t.text}`}>No updates yet</h3>
            <p className={`max-w-sm text-xs leading-relaxed ${t.textMuted}`}>
              Updates show up here when tasks move between columns, comments are
              posted, or someone mentions you. Try moving a card or leaving a
              comment.
            </p>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h3
                className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
              >
                Filter
              </h3>
              <div className="relative">
                <Search
                  className={`pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 ${t.textSubtle}`}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search updates, task refs, titles…"
                  className={`h-9 w-full rounded-md border pr-3 pl-8 text-xs ${t.input}`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const active = filter === f.id
                  const n = counts[f.id]
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition ${
                        active ? t.chipActive + ' border-transparent' : t.chip
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                          active
                            ? mode === 'light'
                              ? 'bg-white/20 text-white'
                              : 'bg-black/30 text-white'
                            : t.surfaceMuted + ' ' + t.textSubtle
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {filtered.length === 0 ? (
              <p className={`py-10 text-center text-xs italic ${t.textSubtle}`}>
                No updates match your filters.
              </p>
            ) : (
              BUCKETS.map((b) =>
                grouped[b.id].length === 0 ? null : (
                  <section key={b.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
                      >
                        {b.label}
                      </h3>
                      <span
                        className={`text-[10px] tabular-nums ${t.textSubtle}`}
                      >
                        {grouped[b.id].length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {grouped[b.id].map((a) => {
                        const Icon = kindIcon(a.kind)
                        const tone = kindTone(a.kind, mode)
                        const clickable = Boolean(
                          a.taskId || a.meetingId || a.meetUrl
                        )
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => {
                                if (a.taskId) {
                                  onOpenTask(a.taskId)
                                } else if (a.meetingId) {
                                  if (
                                    a.meetingAction === 'meeting.reviewed' &&
                                    typeof window !== 'undefined'
                                  ) {
                                    window.open(
                                      `/share/meeting/${a.meetingId}`,
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  } else {
                                    onOpenMeeting(a.meetingId)
                                  }
                                } else if (
                                  a.meetUrl &&
                                  typeof window !== 'undefined'
                                ) {
                                  window.open(
                                    a.meetUrl,
                                    '_blank',
                                    'noopener,noreferrer'
                                  )
                                }
                              }}
                              disabled={!clickable}
                              className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-default ${t.column} ${clickable ? t.rowHover : ''}`}
                            >
                              <span
                                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${tone}`}
                              >
                                <Icon className="size-3.5" />
                              </span>
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  {a.taskRef && (
                                    <span
                                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wider tabular-nums ${t.metaTag}`}
                                    >
                                      {a.taskRef}
                                    </span>
                                  )}
                                  {a.taskTitle && (
                                    <span
                                      className={`truncate text-xs ${t.textMuted}`}
                                    >
                                      {a.taskTitle}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-sm leading-snug ${t.text}`}
                                >
                                  {a.text}
                                </span>
                              </div>
                              <span
                                className={`shrink-0 self-center text-[10px] tracking-wider uppercase ${t.textSubtle}`}
                              >
                                {a.at}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
