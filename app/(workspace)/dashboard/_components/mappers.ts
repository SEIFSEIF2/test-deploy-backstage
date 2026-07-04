// Mappers from Supabase/Prisma DB shapes → the dashboard's frontend types.
// The frontend types live in `boardData.ts` and `status.ts`. We keep them
// stable so the hundreds of lines of UI code don't need to know that the
// data now comes from a database.

import type { DashboardTask, DashboardMember, DashboardProject } from '../types'
import type {
  BoardAssignee,
  BoardTask,
  Sprint,
  TaskRelation,
  ChecklistItem
} from './boardData'
import type { TaskStatus, TaskPriority, RelationKind } from './status'
import type { TaskComment, TaskActivity } from './TaskDetail'
import type {
  ProjectExternalRef,
  TaskExternalRef,
  TaskExternalRefKind
} from './boardData'

// Stable color rotation for assignees keyed by index.
const COLOR_RING = [
  'bg-red-500/80',
  'bg-sky-500/80',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-violet-500/80',
  'bg-pink-500/80',
  'bg-cyan-500/80',
  'bg-indigo-500/80'
]

export function memberColor(index: number) {
  return COLOR_RING[index % COLOR_RING.length]
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function mapMember(
  member: DashboardMember,
  index: number
): BoardAssignee {
  return {
    id: member.id,
    initials: initialsFromName(member.fullName),
    name: member.fullName,
    color: memberColor(index),
    photo: member.avatarUrl ?? undefined,
    role: member.accessTier,
    slug: member.slug ?? null,
    lastSeenAt: member.lastSeenAt,
    activityStatus: member.activityStatus,
    timezone: member.timezone,
    joinedAt: member.joinedAt
  }
}

export function mapMembers(members: DashboardMember[]): BoardAssignee[] {
  return members.map((m, i) => mapMember(m, i))
}

function formatDueDate(
  d: Date | string | null | undefined
): string | undefined {
  if (!d) return undefined
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function mapTask(
  task: DashboardTask,
  membersByDbId: Map<string, BoardAssignee>
): BoardTask {
  const assignee = task.assigneeId
    ? membersByDbId.get(task.assigneeId)
    : undefined
  const lead = task.leadId ? membersByDbId.get(task.leadId) : undefined

  const tags = task.labels
    .map((tl) => tl.label?.name)
    .filter((n): n is string => Boolean(n))

  const checklist: ChecklistItem[] = task.checklist.map((c) => ({
    id: c.id,
    text: c.text,
    done: c.isDone
  }))

  // depsOut: this task → dependsOn target (e.g. "this blocks X" or "this is sub_issue of X")
  // depsIn: someone else → this task (the inverse direction)
  const relationsOut: TaskRelation[] = task.depsOut
    .filter((d) => d.dependsOn?.ref)
    .map((d) => ({ kind: d.kind as RelationKind, ref: d.dependsOn!.ref! }))
  const relationsIn: TaskRelation[] = task.depsIn
    .filter((d) => d.task?.ref)
    .map((d) => ({
      kind: invertRelation(d.kind as RelationKind),
      ref: d.task!.ref!
    }))
  const relations = [...relationsOut, ...relationsIn]

  return {
    id: task.id,
    ref: task.ref ?? task.id.slice(0, 8).toUpperCase(),
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    assignee,
    lead,
    createdById: task.createdBy ?? undefined,
    projectId: task.projectId ?? undefined,
    tags: tags.length ? tags : undefined,
    due: formatDueDate(task.dueDate),
    dueAt: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
    sortOrder: task.sortOrder ?? undefined,
    createdAt: String(task.createdAt).slice(0, 10),
    updatedAt: String(task.updatedAt),
    relations: relations.length ? relations : undefined,
    checklist: checklist.length ? checklist : undefined
  }
}

function invertRelation(kind: RelationKind): RelationKind {
  switch (kind) {
    case 'blocked_by':
      return 'blocks'
    case 'blocks':
      return 'blocked_by'
    case 'parent':
      return 'sub_issue'
    case 'sub_issue':
      return 'parent'
    default:
      return kind
  }
}

export function mapTasks(
  tasks: DashboardTask[],
  members: BoardAssignee[],
  dbMembers: DashboardMember[]
): BoardTask[] {
  // Build a lookup of DB-id → BoardAssignee using the same index used to color.
  const byDbId = new Map<string, BoardAssignee>()
  dbMembers.forEach((m, i) => {
    byDbId.set(m.id, members[i])
  })
  return tasks.map((t) => mapTask(t, byDbId))
}

// ─── Sprints ───────────────────────────────────────────────────────────────

type DashSprint = {
  id: string
  projectId: string
  number: number
  name: string
  goal: string | null
  description: string | null
  docUrl: string | null
  status: 'completed' | 'current' | 'upcoming'
  fromDate: Date | string
  toDate: Date | string
  startedAt: Date | string | null
  closedAt: Date | string | null
  shippedCount: number | null
  carriedCount: number | null
  tasks: { taskId: string; carryCount: number }[]
}

function toIsoDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 10)
}

function toIsoStringOrNull(d: Date | string | null): string | null {
  if (d === null) return null
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString()
}

export function mapSprint(sprint: DashSprint, allTasks: BoardTask[]): Sprint {
  const taskIds = sprint.tasks.map((t) => t.taskId)
  const carryCountByTaskId: Record<string, number> = {}
  for (const t of sprint.tasks) {
    carryCountByTaskId[t.taskId] = t.carryCount ?? 0
  }
  const sprintTasks = allTasks.filter((t) => taskIds.includes(t.id))
  const scope = sprintTasks.length
  const startedCount = sprintTasks.filter(
    (t) => t.status !== 'backlog' && t.status !== 'unscoped'
  ).length
  const completedCount = sprintTasks.filter((t) => t.status === 'done').length

  return {
    id: sprint.id,
    projectId: sprint.projectId,
    number: sprint.number,
    name: sprint.name,
    goal: sprint.goal,
    description: sprint.description,
    docUrl: sprint.docUrl,
    status: sprint.status,
    from: formatDueDate(sprint.fromDate as Date) ?? '',
    to: formatDueDate(sprint.toDate as Date) ?? '',
    fromIso: toIsoDate(sprint.fromDate),
    toIso: toIsoDate(sprint.toDate),
    startedAtIso: toIsoStringOrNull(sprint.startedAt),
    closedAtIso: toIsoStringOrNull(sprint.closedAt),
    shippedCount: sprint.shippedCount,
    carriedCount: sprint.carriedCount,
    scope,
    startedCount,
    startedPct: scope ? Math.round((startedCount / scope) * 100) : 0,
    completedCount,
    completedPct: scope ? Math.round((completedCount / scope) * 100) : 0,
    percent: scope ? Math.round((completedCount / scope) * 100) : 0,
    taskIds,
    carryCountByTaskId
  }
}

export function mapSprints(
  sprints: DashSprint[],
  allTasks: BoardTask[]
): Sprint[] {
  return sprints.map((c) => mapSprint(c, allTasks))
}

// ─── Comments + Activity ─────────────────────────────────────────────────

type DbComment = {
  id: string
  taskId: string
  body: string
  createdAt: Date | string
  editedAt: Date | string | null
  mentions: string[]
  author: { id: string; fullName: string } | null
}

type DbActivity = {
  id: string
  entityId: string | null
  action: string
  createdAt: Date | string
  metadata: unknown
  actor: { id: string; fullName: string } | null
}

function formatTimestamp(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function groupCommentsByTask(
  comments: DbComment[]
): Record<string, TaskComment[]> {
  const out: Record<string, TaskComment[]> = {}
  for (const c of comments) {
    const list = out[c.taskId] ?? []
    const authorName = c.author?.fullName ?? 'Someone'
    const createdAtIso =
      c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : new Date(c.createdAt).toISOString()
    list.push({
      id: c.id,
      author: authorName,
      authorId: c.author?.id ?? null,
      authorInitials: initialsFromName(authorName),
      body: c.body,
      at: formatTimestamp(c.createdAt),
      createdAt: createdAtIso,
      editedAt: c.editedAt
        ? (c.editedAt instanceof Date
            ? c.editedAt
            : new Date(c.editedAt)
          ).toISOString()
        : undefined,
      mentions: c.mentions
    })
    out[c.taskId] = list
  }
  return out
}

// Maps a DB activity row to the dashboard's TaskActivity. The frontend
// only renders a small set of kinds; anything else is bucketed as 'status'
// so the timeline renders without losing the event.
function activityKindFor(action: string): TaskActivity['kind'] {
  if (action.startsWith('comment.')) return 'comment'
  if (action === 'task.created') return 'created'
  if (action === 'task.priority_changed') return 'priority'
  if (action === 'task.assignee_changed') return 'assignee'
  if (action === 'task.lead_changed') return 'assignee'
  if (action === 'task.attachment_added') return 'attachment'
  if (action === 'task.due_soon') return 'due-soon'
  return 'status'
}

function formatStatus(v: unknown): string {
  return String(v).replace(/_/g, ' ')
}

function activityTextFor(row: DbActivity): string {
  const who = row.actor?.fullName ?? 'Someone'
  const meta = (row.metadata as Record<string, unknown> | null) ?? null
  const from = meta?.from
  const to = meta?.to
  switch (row.action) {
    case 'task.created':
      return `${who} created the task`
    case 'task.status_changed':
      if (from != null && to != null) {
        return `${who} moved this from ${formatStatus(from)} to ${formatStatus(to)}`
      }
      // Old-format rows from before the from/to migration.
      if (meta?.status)
        return `${who} set status to ${formatStatus(meta.status)}`
      return `${who} changed status`
    case 'task.priority_changed':
      if (from != null && to != null) {
        return `${who} changed priority from ${from} to ${to}`
      }
      if (meta?.priority) return `${who} set priority to ${meta.priority}`
      return `${who} changed priority`
    case 'task.assignee_changed': {
      const fromName = meta?.fromName ?? null
      const toName = meta?.toName ?? null
      if (toName && fromName)
        return `${who} reassigned from ${fromName} to ${toName}`
      if (toName) return `${who} assigned this to ${toName}`
      if (fromName) return `${who} unassigned ${fromName}`
      return `${who} reassigned the task`
    }
    case 'task.lead_changed': {
      const fromName = meta?.fromName ?? null
      const toName = meta?.toName ?? null
      if (toName && fromName)
        return `${who} changed lead from ${fromName} to ${toName}`
      if (toName) return `${who} set ${toName} as lead`
      if (fromName) return `${who} removed ${fromName} as lead`
      return `${who} changed the lead`
    }
    case 'task.duplicated':
      return `${who} duplicated this task`
    case 'task.deleted':
      return `${who} deleted the task`
    case 'task.project_changed': {
      const fromName = meta?.fromName ?? null
      const toName = meta?.toName ?? null
      const fromRef = meta?.fromRef ?? null
      const toRef = meta?.toRef ?? null
      if (fromName && toName) {
        const refLine = fromRef && toRef ? ` (${fromRef} -> ${toRef})` : ''
        return `${who} moved this from ${fromName} to ${toName}${refLine}`
      }
      if (toName) return `${who} moved this to ${toName}`
      return `${who} moved this to a new project`
    }
    case 'task.tags_changed': {
      const tags = Array.isArray(meta?.tags) ? meta.tags : null
      if (!tags || tags.length === 0) return `${who} cleared the tags`
      return `${who} set tags to ${tags.join(', ')}`
    }
    case 'task.attachment_added': {
      const name =
        typeof meta?.fileName === 'string' ? (meta.fileName as string) : null
      return name ? `${who} added an image (${name})` : `${who} added an image`
    }
    case 'task.attachment_removed':
      return `${who} removed an image`
    case 'task.due_changed': {
      if (from != null && to != null) return `${who} changed the due date`
      if (to != null) return `${who} set a due date`
      if (from != null) return `${who} cleared the due date`
      return `${who} changed the due date`
    }
    case 'task.due_soon': {
      const ref = typeof meta?.task_ref === 'string' ? meta.task_ref : null
      const refPart = ref ? `${ref} ` : ''
      return `Heads up: ${refPart}is due tomorrow`
    }
    case 'comment.added':
      return `${who} left a comment`
    case 'comment.edited':
      return `${who} edited a comment`
    case 'comment.deleted':
      return `${who} deleted a comment`
    default:
      return `${who} · ${row.action}`
  }
}

// Converts team-management activity_log rows into the UpdateRow shape
// the dashboard's globalActivity feed consumes. These rows have no
// taskId (entity_type is 'team_member' or 'team_invite'), so we pass
// null for the task fields.
export interface TeamUpdate {
  id: string
  kind: 'team'
  text: string
  at: string
  atRaw: string
  taskId: null
  taskRef: null
  taskTitle: null
  // For room.invite rows: the Meet URL captured in metadata so the
  // Updates panel can open it on click. Null for other team events.
  meetUrl: string | null
}

export function mapTeamActivity(
  activity: DbActivity[],
  memberNamesById: Map<string, string>,
  viewerId: string
): TeamUpdate[] {
  return activity
    .filter((a) => {
      if (a.action !== 'room.invite') return true
      const meta = (a.metadata as Record<string, unknown> | null) ?? null
      const to = Array.isArray(meta?.to) ? (meta.to as string[]) : []
      return to.includes(viewerId)
    })
    .map((a) => {
      const created =
        a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const meta = (a.metadata as Record<string, unknown> | null) ?? null
      const meetUrl =
        a.action === 'room.invite' && typeof meta?.meetUrl === 'string'
          ? (meta.meetUrl as string)
          : null
      return {
        id: a.id,
        kind: 'team' as const,
        text: teamActivityTextFor(a, memberNamesById),
        at: formatTimestamp(a.createdAt),
        atRaw: created.toISOString(),
        taskId: null,
        taskRef: null,
        taskTitle: null,
        meetUrl
      }
    })
}

function teamActivityTextFor(
  row: DbActivity,
  memberNamesById: Map<string, string>
): string {
  const who = row.actor?.fullName ?? 'Someone'
  const targetName = row.entityId
    ? (memberNamesById.get(row.entityId) ?? null)
    : null
  const meta = (row.metadata as Record<string, unknown> | null) ?? null
  switch (row.action) {
    case 'team.tier_changed':
      if (meta?.from && meta?.to && targetName) {
        return `${who} changed ${targetName} from ${meta.from} to ${meta.to}`
      }
      return `${who} changed an access tier`
    case 'team.presence_changed':
      if (meta?.to && targetName) {
        return `${who} marked ${targetName} as ${formatStatus(meta.to)}`
      }
      return `${who} changed a member's presence`
    case 'team.removed':
      return targetName
        ? `${who} removed ${targetName} from the workspace`
        : `${who} removed a member`
    case 'team.reinstated':
      return targetName
        ? `${who} reinstated ${targetName}`
        : `${who} reinstated a member`
    case 'team.profile_edited':
      return targetName
        ? `${who} edited ${targetName}'s profile`
        : `${who} edited a member's profile`
    case 'team.invited':
      if (meta?.email) return `${who} invited ${meta.email}`
      return `${who} invited a new member`
    case 'team.invite_canceled':
      return `${who} canceled an invite`
    case 'room.invite':
      return `${who} invited you to the quick room`
    default:
      return `${who} · ${row.action}`
  }
}

// Meeting activity rows carry the meeting id on entityId. We surface
// them on the Updates feed with a clickable affordance that opens the
// MeetingsSheet focused on that meeting.
export interface MeetingUpdate {
  id: string
  kind: 'meeting'
  text: string
  at: string
  atRaw: string
  taskId: null
  taskRef: null
  taskTitle: null
  meetingId: string | null
  // Original action string from activity_logs ("meeting.reviewed",
  // "meeting.requested", ...). UpdatesPanel uses it to route clicks:
  // reviewed → share page (has the recap), everything else → inbox
  // sheet which still has the meeting in an active section.
  meetingAction: string | null
}

export function mapMeetingActivity(activity: DbActivity[]): MeetingUpdate[] {
  return activity.map((a) => {
    const created =
      a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
    return {
      id: a.id,
      kind: 'meeting' as const,
      text: meetingActivityTextFor(a),
      at: formatTimestamp(a.createdAt),
      atRaw: created.toISOString(),
      taskId: null,
      taskRef: null,
      taskTitle: null,
      meetingId: a.entityId ?? null,
      meetingAction: a.action ?? null
    }
  })
}

function meetingActivityTextFor(row: DbActivity): string {
  const who = row.actor?.fullName ?? 'Someone'
  const meta = (row.metadata as Record<string, unknown> | null) ?? null
  const title =
    typeof meta?.title === 'string' && meta.title
      ? `"${meta.title}"`
      : 'a meeting'
  switch (row.action) {
    case 'meeting.requested':
      return `${who} requested ${title}`
    case 'meeting.approved':
      return `${who} approved ${title}`
    case 'meeting.scheduled':
      return `${who} scheduled ${title}`
    case 'meeting.rejected':
      return `${who} rejected ${title}`
    case 'meeting.declined':
      return `${who} declined ${title}`
    case 'meeting.rescheduled':
      return `${who} rescheduled ${title}`
    case 'meeting.canceled':
      return `${who} canceled ${title}`
    case 'meeting.reviewed': {
      const outcomeLabels: Record<string, string> = {
        resolved: 'resolved',
        partial: 'partially resolved',
        needs_followup: 'needs a follow-up',
        failed: "didn't deliver"
      }
      const outcome =
        typeof meta?.outcome === 'string'
          ? (outcomeLabels[meta.outcome] ?? meta.outcome)
          : null
      return outcome
        ? `${who} reviewed ${title} (${outcome})`
        : `${who} reviewed ${title}`
    }
    default:
      return `${who} · ${row.action}`
  }
}

// Task deletion / restore events. Pulled separately from per-task activity
// because the row no longer matches a visible task ID (or wouldn't, for
// deletes). Title/ref/status are snapshot into metadata at delete time so
// the feed can render them without a join back to the (gone or trashed) row.
export interface TaskDeletionUpdate {
  id: string
  kind: 'task-deletion'
  // 'task.deleted' or 'task.restored'
  action: 'task.deleted' | 'task.restored'
  text: string
  at: string
  atRaw: string
  // taskId is the id of the (now tombstoned) row. Restore actions surface
  // it so the UI can hide its own row from the Trash list optimistically.
  taskId: string | null
  taskRef: string | null
  taskTitle: string | null
}

export interface SprintUpdate {
  id: string
  kind: 'sprint'
  action: 'sprint.started' | 'sprint.ended'
  text: string
  at: string
  atRaw: string
  sprintId: string | null
  projectId: string | null
  sprintNumber: number | null
  goal: string | null
  goalMet: boolean | null
  shippedCount: number | null
  carriedCount: number | null
}

export function mapSprintActivity(activity: DbActivity[]): SprintUpdate[] {
  return activity.map((a) => {
    const created =
      a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
    const meta = (a.metadata as Record<string, unknown> | null) ?? null
    const who = a.actor?.fullName ?? 'Someone'
    const sprintNumber =
      meta && typeof meta.sprint_number === 'number'
        ? (meta.sprint_number as number)
        : null
    const sprintLabel =
      sprintNumber !== null ? `Sprint ${sprintNumber}` : 'a sprint'
    const goal =
      meta && typeof meta.goal === 'string' && meta.goal
        ? (meta.goal as string)
        : null
    const projectId =
      meta && typeof meta.project_id === 'string'
        ? (meta.project_id as string)
        : null
    let text: string
    const goalMet =
      meta && typeof meta.goal_met === 'boolean'
        ? (meta.goal_met as boolean)
        : null
    const shippedCount =
      meta && typeof meta.shipped_count === 'number'
        ? (meta.shipped_count as number)
        : null
    const carriedCount =
      meta && typeof meta.carried_count === 'number'
        ? (meta.carried_count as number)
        : null
    if (a.action === 'sprint.started') {
      const goalPart = goal ? ` - goal: ${goal}` : ''
      text = `${who} started ${sprintLabel}${goalPart}`
    } else {
      const parts: string[] = []
      if (shippedCount !== null) parts.push(`${shippedCount} shipped`)
      if (carriedCount !== null && carriedCount > 0)
        parts.push(`${carriedCount} carried`)
      const stats = parts.length ? ` - ${parts.join(', ')}` : ''
      const goalPart = goal
        ? goalMet === null
          ? ` (Goal: ${goal})`
          : goalMet
            ? ` (Goal met)`
            : ` (Goal not met)`
        : ''
      text = `${who} ended ${sprintLabel}${stats}${goalPart}`
    }
    return {
      id: a.id,
      kind: 'sprint' as const,
      action: (a.action === 'sprint.ended'
        ? 'sprint.ended'
        : 'sprint.started') as 'sprint.started' | 'sprint.ended',
      text,
      at: formatTimestamp(a.createdAt),
      atRaw: created.toISOString(),
      sprintId: a.entityId ?? null,
      projectId,
      sprintNumber,
      goal,
      goalMet,
      shippedCount,
      carriedCount
    }
  })
}

export function mapTaskDeletionActivity(
  activity: DbActivity[]
): TaskDeletionUpdate[] {
  return activity.map((a) => {
    const created =
      a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
    const meta = (a.metadata as Record<string, unknown> | null) ?? null
    const title =
      typeof meta?.title === 'string' ? (meta.title as string) : null
    const ref = typeof meta?.ref === 'string' ? (meta.ref as string) : null
    const who = a.actor?.fullName ?? 'Someone'
    const verb = a.action === 'task.restored' ? 'restored' : 'deleted'
    const refPart = ref ? `${ref} ` : ''
    const titlePart = title ? `"${title}"` : 'a task'
    const text = `${who} ${verb} ${refPart}${titlePart}`
      .replace(/\s+/g, ' ')
      .trim()
    return {
      id: a.id,
      kind: 'task-deletion' as const,
      action: (a.action === 'task.restored'
        ? 'task.restored'
        : 'task.deleted') as 'task.deleted' | 'task.restored',
      text,
      at: formatTimestamp(a.createdAt),
      atRaw: created.toISOString(),
      taskId: a.entityId ?? null,
      taskRef: ref,
      taskTitle: title
    }
  })
}

export function groupActivityByTask(
  activity: DbActivity[]
): Record<string, TaskActivity[]> {
  const out: Record<string, TaskActivity[]> = {}
  for (const a of activity) {
    if (!a.entityId) continue
    const list = out[a.entityId] ?? []
    const created =
      a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
    list.push({
      id: a.id,
      kind: activityKindFor(a.action),
      text: activityTextFor(a),
      at: formatTimestamp(a.createdAt),
      atRaw: created.toISOString()
    })
    out[a.entityId] = list
  }
  return out
}

// ─── External refs (PR / issue / doc links) ──────────────────────────────

type DbExternalRef = {
  id: string
  taskId: string
  kind: TaskExternalRefKind
  url: string
  label: string | null
  createdAt: Date | string
}

export function groupExternalRefsByTask(
  refs: DbExternalRef[]
): Record<string, TaskExternalRef[]> {
  const out: Record<string, TaskExternalRef[]> = {}
  for (const r of refs) {
    const list = out[r.taskId] ?? []
    const created =
      r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)
    list.push({
      id: r.id,
      taskId: r.taskId,
      kind: r.kind,
      url: r.url,
      label: r.label,
      createdAt: created.toISOString()
    })
    out[r.taskId] = list
  }
  return out
}

type DbProjectExternalRef = {
  id: string
  projectId: string
  kind: TaskExternalRefKind
  url: string
  label: string | null
  createdAt: Date | string
}

export function groupExternalRefsByProject(
  refs: DbProjectExternalRef[]
): Record<string, ProjectExternalRef[]> {
  const out: Record<string, ProjectExternalRef[]> = {}
  for (const r of refs) {
    const list = out[r.projectId] ?? []
    const created =
      r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)
    list.push({
      id: r.id,
      projectId: r.projectId,
      kind: r.kind,
      url: r.url,
      label: r.label,
      createdAt: created.toISOString()
    })
    out[r.projectId] = list
  }
  return out
}
