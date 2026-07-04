import { Inbox } from 'lucide-react'
import type { BoardTask, Sprint } from './boardData'
import { type CopyMenuItem } from '@/components/ui/copy-button'
import { viewToJson, viewToMarkdown } from '@/lib/export/view'
import { sprintToMarkdown } from '@/lib/export/sprint'
import { isInScope, type TimeScope } from '@/lib/export/timeRange'
import type { ExportContext } from '@/lib/export/types'
import type { View, GroupBy } from './DashboardShell'

// ─── Copy-view helpers ────────────────────────────────────────────────────
// Derive a stable title + scope label from the current view + project so
// the markdown header reads naturally. The default group-by mirrors what
// the user sees on screen (status / priority / assignee) so the paste
// matches the visual structure.

export function viewTitle(
  view: View,
  currentProjectId: string | null,
  projects: { id: string; name: string }[]
): string {
  const project = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null
  const base = (() => {
    if (view === 'mine') return 'My tasks'
    if (view === 'inbox') return 'Inbox'
    if (view === 'mentions') return 'Mentions'
    if (view === 'projects') return 'Projects'
    if (view === 'updates') return 'Updates'
    if (view === 'meetings') return 'Meetings calendar'
    if (view === 'symbols') return 'Symbol library'
    if (view === 'settings') return 'Workspace settings'
    if (view === 'team') return 'Team'
    if (view === 'archive') return 'Archive'
    if (view === 'trash') return 'Trash'
    if (view === 'onboarding') return 'Onboarding'
    if (view === 'marketplace') return 'Marketplace'
    if (view === 'plugin') return 'Plugin'
    return 'All tasks'
  })()
  return project ? `${project.name} — ${base}` : base
}

export function buildViewMarkdown(args: {
  tasks: BoardTask[]
  ctx: ExportContext
  view: View
  groupBy: GroupBy
  currentProjectId: string | null
  projects: { id: string; name: string }[]
}): string {
  return viewToMarkdown(
    args.tasks,
    args.ctx,
    {
      title: viewTitle(args.view, args.currentProjectId, args.projects),
      groupBy: args.groupBy
    },
    { brief: true, withoutCommentsAndActivity: true }
  )
}

export function scopedTasks(
  tasks: BoardTask[],
  scope: Exclude<TimeScope, 'all' | 'sprint'>
): BoardTask[] {
  const now = new Date()
  // "Today / This week / This month" buckets are based on updatedAt so the
  // export captures recent movement (drops, status changes, comments) not
  // just newly-created tasks.
  return tasks.filter((task) => isInScope(task.updatedAt, scope, now))
}

export function buildViewCopyMenu(args: {
  filtered: BoardTask[]
  allTasks: BoardTask[]
  ctx: ExportContext
  view: View
  groupBy: GroupBy
  currentProjectId: string | null
  projects: { id: string; name: string }[]
  sprints: Sprint[]
}): CopyMenuItem[] {
  const baseTitle = viewTitle(args.view, args.currentProjectId, args.projects)
  const meta = (extra?: string) => ({
    title: extra ? `${baseTitle} (${extra})` : baseTitle,
    groupBy: args.groupBy,
    scopeLabel: extra
  })
  const items: CopyMenuItem[] = [
    {
      id: 'md-brief',
      label: 'Copy as Markdown',
      description: 'One line per task, sprint context up top',
      getContent: () =>
        viewToMarkdown(args.filtered, args.ctx, meta(), {
          brief: true,
          withoutCommentsAndActivity: true
        }),
      toastLabel: 'page as Markdown'
    },
    {
      id: 'md-detailed',
      label: 'Copy as Markdown (detailed)',
      description: 'Full task blocks with comments + activity',
      getContent: () => viewToMarkdown(args.filtered, args.ctx, meta()),
      toastLabel: 'page as Markdown'
    },
    {
      id: 'json-full',
      label: 'Copy as JSON',
      description: 'Versioned shape for agent ingestion',
      getContent: () => viewToJson(args.filtered, args.ctx, meta()),
      toastLabel: 'page as JSON'
    },
    {
      id: 'json-slim',
      label: 'Copy as JSON (no comments)',
      description: 'Slim shape, metadata only',
      getContent: () =>
        viewToJson(args.filtered, args.ctx, meta(), {
          withoutCommentsAndActivity: true
        }),
      toastLabel: 'page as JSON'
    }
  ]
  // Time-scope shortcuts always operate on the *unfiltered* visible task set
  // so the user can grab "everything updated this week" without losing
  // tasks the on-screen filters have hidden.
  items.push(
    {
      id: 'today',
      label: 'Copy today (Markdown)',
      description: 'Tasks updated since midnight',
      separatorBefore: true,
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'today'),
          args.ctx,
          meta('today'),
          { brief: true, withoutCommentsAndActivity: true }
        ),
      toastLabel: "today's tasks"
    },
    {
      id: 'week',
      label: 'Copy this week (Markdown)',
      description: 'Tasks updated since Monday',
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'week'),
          args.ctx,
          meta('this week'),
          { brief: true, withoutCommentsAndActivity: true }
        ),
      toastLabel: "this week's tasks"
    },
    {
      id: 'month',
      label: 'Copy this month (Markdown)',
      description: 'Tasks updated this calendar month',
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'month'),
          args.ctx,
          meta('this month'),
          { brief: true, withoutCommentsAndActivity: true }
        ),
      toastLabel: "this month's tasks"
    }
  )

  const projectScopedSprints = args.currentProjectId
    ? args.sprints.filter((c) => c.projectId === args.currentProjectId)
    : args.sprints
  if (projectScopedSprints.length > 0) {
    items.push({
      id: 'by-sprint',
      label: 'Copy by sprint',
      description: 'Pick a sprint to export',
      separatorBefore: true,
      submenu: projectScopedSprints.map((c) => ({
        id: `sprint-${c.id}`,
        label: `${c.name} (${c.status})`,
        getContent: () => sprintToMarkdown(c, args.ctx),
        toastLabel: `sprint ${c.name}`
      }))
    })
  }
  return items
}
