import type {
  BoardAssignee,
  BoardTask,
  Sprint
} from '@/app/(workspace)/dashboard/_components/boardData'

// Static fixtures shaped exactly like the production BoardTask /
// BoardAssignee / Sprint types so the real TaskCard + BoardColumn
// components render them unchanged.

export const DEMO_MEMBERS: BoardAssignee[] = [
  {
    id: 'm-alex',
    initials: 'AR',
    name: 'Alex Rivers',
    color: '#948CC0',
    role: 'Product engineer',
    slug: 'alex-rivers',
    activityStatus: 'active',
    timezone: 'Europe/London',
    joinedAt: '2025-02-10T09:00:00Z',
    lastSeenAt: new Date().toISOString()
  },
  {
    id: 'm-nadia',
    initials: 'NK',
    name: 'Nadia Kern',
    color: '#F0A868',
    role: 'Design lead',
    slug: 'nadia-kern',
    activityStatus: 'active',
    timezone: 'Europe/Berlin',
    joinedAt: '2025-05-01T09:00:00Z',
    lastSeenAt: new Date(Date.now() - 15 * 60_000).toISOString()
  },
  {
    id: 'm-omar',
    initials: 'OS',
    name: 'Omar Sadiq',
    color: '#5CB4A1',
    role: 'Backend',
    slug: 'omar-sadiq',
    activityStatus: 'active',
    timezone: 'Asia/Dubai',
    joinedAt: '2024-11-14T09:00:00Z',
    lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString()
  },
  {
    id: 'm-lena',
    initials: 'LV',
    name: 'Lena Voss',
    color: '#D77070',
    role: 'Ops',
    slug: 'lena-voss',
    activityStatus: 'active',
    timezone: 'Europe/Amsterdam',
    joinedAt: '2025-08-01T09:00:00Z',
    lastSeenAt: new Date(Date.now() - 60 * 60_000).toISOString()
  },
  {
    id: 'm-tomas',
    initials: 'TR',
    name: 'Tomas Rea',
    color: '#7089C7',
    role: 'Founder',
    slug: 'tomas-rea',
    activityStatus: 'active',
    timezone: 'Europe/Malta',
    joinedAt: '2024-01-01T09:00:00Z',
    lastSeenAt: new Date(Date.now() - 45 * 60_000).toISOString()
  }
]

const now = Date.now()
function iso(offsetMs: number): string {
  return new Date(now + offsetMs).toISOString()
}
function dueIso(days: number): string {
  return new Date(now + days * 24 * 60 * 60_000).toISOString()
}

export const DEMO_PROJECT = {
  id: 'p-1',
  name: 'Skam',
  kind: 'standard' as const,
  isArchived: false,
  githubRepo: null as string | null
}

export const DEMO_TASKS: BoardTask[] = [
  {
    id: 't-1',
    ref: 'SKA-101',
    title: 'Redesign the onboarding wizard step order',
    description:
      'Move password step ahead of avatar upload so browsers offer to save the credential. Confirmed with UX research.',
    status: 'in_progress',
    priority: 'high',
    assignee: DEMO_MEMBERS[1],
    lead: DEMO_MEMBERS[0],
    createdById: DEMO_MEMBERS[0].id,
    projectId: DEMO_PROJECT.id,
    tags: ['onboarding', 'ui'],
    due: 'Wed, 2 Jul',
    dueAt: dueIso(1),
    createdAt: iso(-3 * 24 * 60 * 60_000),
    updatedAt: iso(-2 * 60 * 60_000),
    sortOrder: 100,
    checklist: [
      { id: 'ci-1', text: 'Move password step ahead of avatar', done: true },
      { id: 'ci-2', text: 'Update Figma flow', done: true },
      { id: 'ci-3', text: 'QA on Safari + Firefox', done: false }
    ]
  },
  {
    id: 't-2',
    ref: 'SKA-102',
    title: 'Auto-add newly created tasks to current sprint',
    description:
      'When a member creates a task while a sprint is running, drop it into that sprint by default. Opt-out via a chip.',
    status: 'in_review',
    priority: 'medium',
    assignee: DEMO_MEMBERS[0],
    createdById: DEMO_MEMBERS[0].id,
    projectId: DEMO_PROJECT.id,
    tags: [],
    due: 'Fri, 4 Jul',
    dueAt: dueIso(3),
    createdAt: iso(-2 * 24 * 60 * 60_000),
    updatedAt: iso(-30 * 60_000),
    sortOrder: 100
  },
  {
    id: 't-3',
    ref: 'SKA-103',
    title: 'Retro flow for closing sprints',
    description:
      'End-of-sprint prompt: goal met yes/no, shipped tasks count, carried tasks count. Store as sprint activity.',
    status: 'todo',
    priority: 'medium',
    assignee: DEMO_MEMBERS[0],
    projectId: DEMO_PROJECT.id,
    tags: [],
    createdAt: iso(-24 * 60 * 60_000),
    updatedAt: iso(-24 * 60 * 60_000),
    sortOrder: 100
  },
  {
    id: 't-4',
    ref: 'SKA-104',
    title: 'Emoji reactions on comments',
    description:
      'WhatsApp-style tap-and-hold to react. Reuse the emoji-mart picker already in the tree.',
    status: 'done',
    priority: 'low',
    assignee: DEMO_MEMBERS[1],
    projectId: DEMO_PROJECT.id,
    tags: ['ui'],
    createdAt: iso(-6 * 24 * 60 * 60_000),
    updatedAt: iso(-3 * 24 * 60 * 60_000),
    sortOrder: 100
  },
  {
    id: 't-5',
    ref: 'SKA-105',
    title: 'Deadline warning email at 24h',
    description:
      'Daily 07:00 workspace-time cron fires per-company, batching all tasks due within 24h into one digest email.',
    status: 'in_progress',
    priority: 'urgent',
    assignee: DEMO_MEMBERS[2],
    projectId: DEMO_PROJECT.id,
    tags: ['infra'],
    due: 'Tue, 1 Jul',
    dueAt: dueIso(0),
    createdAt: iso(-4 * 24 * 60 * 60_000),
    updatedAt: iso(-4 * 60 * 60_000),
    sortOrder: 200
  },
  {
    id: 't-6',
    ref: 'SKA-106',
    title: 'Marketing landing hero copy',
    description:
      'Short pitch (2 sentences) + 6 feature blurbs. Match the tone of the README.',
    status: 'todo',
    priority: 'medium',
    assignee: DEMO_MEMBERS[3],
    projectId: DEMO_PROJECT.id,
    tags: ['marketing'],
    due: 'Fri, 4 Jul',
    dueAt: dueIso(3),
    createdAt: iso(-2 * 24 * 60 * 60_000),
    updatedAt: iso(-24 * 60 * 60_000),
    sortOrder: 200
  },
  {
    id: 't-7',
    ref: 'SKA-107',
    title: 'Image gallery drag-to-reorder',
    description:
      'Attachments should reorder via drag. Persist sort_order in task_attachments.',
    status: 'backlog',
    priority: 'low',
    projectId: DEMO_PROJECT.id,
    tags: ['ui'],
    createdAt: iso(-8 * 24 * 60 * 60_000),
    updatedAt: iso(-8 * 24 * 60 * 60_000),
    sortOrder: 100
  },
  {
    id: 't-8',
    ref: 'SKA-108',
    title: 'Sidebar keyboard shortcuts',
    description: 'g u = updates, g m = meetings, g o = onboarding.',
    status: 'todo',
    priority: 'low',
    assignee: DEMO_MEMBERS[0],
    projectId: DEMO_PROJECT.id,
    tags: ['ui'],
    createdAt: iso(-24 * 60 * 60_000),
    updatedAt: iso(-24 * 60 * 60_000),
    sortOrder: 300
  },
  {
    id: 't-9',
    ref: 'SKA-109',
    title: 'Broken avatar on Chrome iOS',
    description:
      'Uploaded avatars return 400 on Chrome iOS. Suspected Content-Type mismatch on the multipart POST.',
    status: 'in_progress',
    priority: 'urgent',
    assignee: DEMO_MEMBERS[2],
    projectId: DEMO_PROJECT.id,
    tags: ['bug'],
    due: 'Tue, 1 Jul',
    dueAt: dueIso(0),
    createdAt: iso(-24 * 60 * 60_000),
    updatedAt: iso(-6 * 60 * 60_000),
    sortOrder: 300
  },
  {
    id: 't-10',
    ref: 'SKA-110',
    title: 'AI paste import: accept CSV',
    description:
      'In addition to JSON, accept comma-separated pastes with a title / assignee / priority column.',
    status: 'in_review',
    priority: 'medium',
    assignee: DEMO_MEMBERS[0],
    projectId: DEMO_PROJECT.id,
    tags: [],
    createdAt: iso(-3 * 24 * 60 * 60_000),
    updatedAt: iso(-2 * 60 * 60_000),
    sortOrder: 200
  },
  {
    id: 't-11',
    ref: 'SKA-111',
    title: 'Team roster export (CSV)',
    description:
      'Ops needs a monthly member list for payroll. Owner / admin / lead only.',
    status: 'todo',
    priority: 'medium',
    assignee: DEMO_MEMBERS[3],
    projectId: DEMO_PROJECT.id,
    tags: [],
    due: 'Sun, 6 Jul',
    dueAt: dueIso(5),
    createdAt: iso(-4 * 24 * 60 * 60_000),
    updatedAt: iso(-24 * 60 * 60_000),
    sortOrder: 400
  },
  {
    id: 't-12',
    ref: 'SKA-112',
    title: 'Portfolio page dark theme polish',
    description: 'Contrast pass on the /:handle page in dark mode.',
    status: 'done',
    priority: 'low',
    assignee: DEMO_MEMBERS[1],
    projectId: DEMO_PROJECT.id,
    tags: ['ui'],
    createdAt: iso(-10 * 24 * 60 * 60_000),
    updatedAt: iso(-5 * 24 * 60 * 60_000),
    sortOrder: 200
  },
  {
    id: 't-13',
    ref: 'SKA-113',
    title: 'Symbols panel: search by hex',
    description:
      'Members should be able to paste a hex value and see all symbols using that swatch.',
    status: 'backlog',
    priority: 'low',
    projectId: DEMO_PROJECT.id,
    tags: [],
    createdAt: iso(-12 * 24 * 60 * 60_000),
    updatedAt: iso(-12 * 24 * 60 * 60_000),
    sortOrder: 200
  },
  {
    id: 't-14',
    ref: 'SKA-114',
    title: 'Meeting: warn on stale approvals',
    description:
      'If a 1:1 sits approved but unscheduled for 5 days, nudge both parties.',
    status: 'done',
    priority: 'medium',
    assignee: DEMO_MEMBERS[2],
    projectId: DEMO_PROJECT.id,
    tags: [],
    createdAt: iso(-14 * 24 * 60 * 60_000),
    updatedAt: iso(-7 * 24 * 60 * 60_000),
    sortOrder: 300
  }
]

export const DEMO_SPRINT: Sprint = {
  id: 's-1',
  projectId: DEMO_PROJECT.id,
  number: 12,
  name: 'Sprint 12',
  goal: 'Ship the onboarding revamp and clean up the meeting flow.',
  description: null,
  docUrl: null,
  status: 'current',
  from: 'Mon 30 Jun',
  to: 'Sun 6 Jul',
  fromIso: iso(-3 * 24 * 60 * 60_000),
  toIso: iso(4 * 24 * 60 * 60_000),
  startedAtIso: iso(-3 * 24 * 60 * 60_000),
  closedAtIso: null,
  shippedCount: null,
  carriedCount: null,
  scope: DEMO_TASKS.length,
  startedCount: DEMO_TASKS.filter(
    (t) => t.status !== 'backlog' && t.status !== 'todo'
  ).length,
  startedPct: 0,
  completedCount: DEMO_TASKS.filter((t) => t.status === 'done').length,
  completedPct: 0,
  percent: 0,
  taskIds: DEMO_TASKS.map((t) => t.id),
  carryCountByTaskId: {}
}
