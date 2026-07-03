'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronDown,
  Folder,
  LayoutGrid,
  Settings,
  Sparkles,
  UserPlus,
  Users
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { DashboardThemeProvider, useDashTheme } from '@/app/(workspace)/dashboard/_components/theme'
import { ContextMenuProvider } from '@/app/(workspace)/dashboard/_components/ContextMenu'
import { TeamProvider } from '@/app/(workspace)/dashboard/_components/TeamContext'
import {
  TaskActionsProvider,
  type TaskActions
} from '@/app/(workspace)/dashboard/_components/actions'
import BoardColumn from '@/app/(workspace)/dashboard/_components/BoardColumn'
import TaskCard from '@/app/(workspace)/dashboard/_components/TaskCard'
import type { BoardTask } from '@/app/(workspace)/dashboard/_components/boardData'
import {
  STATUSES,
  STATUS_BY_ID,
  type TaskPriority,
  type TaskStatus
} from '@/app/(workspace)/dashboard/_components/status'
import {
  DEMO_MEMBERS,
  DEMO_PROJECT,
  DEMO_SPRINT,
  DEMO_TASKS
} from '@/lib/demoData'
import { config } from '@/lib/config'

const DEPLOY_URL =
  'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSEIFSEIF4%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6'

// Columns shown in the demo. Matches the real board's status set minus
// canceled/duplicate/unscoped (which are side states, not primary columns).
const DEMO_COLUMN_IDS: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done'
]

export function DemoBoard() {
  return (
    <DashboardThemeProvider>
      <ContextMenuProvider>
        <TeamProvider members={DEMO_MEMBERS}>
          <DemoBoardInner />
        </TeamProvider>
      </ContextMenuProvider>
    </DashboardThemeProvider>
  )
}

function DemoBoardInner() {
  const { t } = useDashTheme()
  const [tasks, setTasks] = useState<BoardTask[]>(DEMO_TASKS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const actions = useMemo<TaskActions>(
    () => ({
      changeStatus: (id, s) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: s } : t)))
        toast.success('Status updated (demo, no persistence)')
      },
      changePriority: (id, p) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority: p } : t)))
      },
      changeAssignee: (id, assigneeId) => {
        const assignee = assigneeId
          ? DEMO_MEMBERS.find((m) => m.id === assigneeId) ?? undefined
          : undefined
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, assignee } : t))
        )
      },
      changeProject: () => {
        toast.info('Only one project in demo mode.')
      },
      projects: [{ id: DEMO_PROJECT.id, name: DEMO_PROJECT.name }],
      duplicate: (id) => {
        setTasks((prev) => {
          const src = prev.find((t) => t.id === id)
          if (!src) return prev
          const clone: BoardTask = {
            ...src,
            id: `${src.id}-dup-${prev.length}`,
            ref: `${src.ref}-dup`,
            title: `${src.title} (copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          return [...prev, clone]
        })
      },
      remove: (id) => {
        setTasks((prev) => prev.filter((t) => t.id !== id))
      },
      copyRef: (ref) => {
        if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(ref)
        toast.success(`Copied ${ref}`)
      },
      copyShareLink: (ref) => {
        toast.info(`Share links are disabled in demo mode (${ref})`)
      },
      openDetail: (id) => setSelectedId(id),
      addInColumn: (status) => {
        setTasks((prev) => {
          const nextRef = `SKA-${100 + prev.length + 1}`
          const created: BoardTask = {
            id: `t-${nextRef}`,
            ref: nextRef,
            title: 'New demo task',
            description: null,
            status: status ?? 'todo',
            priority: 'medium',
            projectId: DEMO_PROJECT.id,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sortOrder: 1000
          }
          return [...prev, created]
        })
      },
      toggleStatusFilter: () => toast.info('Filters disabled in demo mode.'),
      clearStatusFilter: () => undefined,
      toggleAssigneeFilter: () => toast.info('Filters disabled in demo mode.'),
      clearAssigneeFilter: () => undefined,
      canDeleteTasks: true,
      sprintsForProject: (projectId) =>
        projectId === DEMO_PROJECT.id
          ? [{ id: DEMO_SPRINT.id, name: DEMO_SPRINT.name, status: 'current' }]
          : [],
      addToSprint: () => {
        toast.success('Added to sprint (demo)')
      }
    }),
    []
  )

  const groups = useMemo(
    () =>
      DEMO_COLUMN_IDS.map((id) => ({
        key: id,
        label: STATUS_BY_ID[id].label,
        items: tasks.filter((t) => t.status === id)
      })),
    [tasks]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }, [])

  const onDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = e
    if (!over) return
    const overId = String(over.id)
    const activeId = String(active.id)
    const targetStatus = overId.startsWith('col:')
      ? (overId.slice(4) as TaskStatus)
      : null
    if (!targetStatus) return
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId && t.status !== targetStatus
          ? { ...t, status: targetStatus }
          : t
      )
    )
  }, [])

  const onDragCancel = useCallback(() => {
    setActiveDragId(null)
  }, [])

  const activeTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId) ?? null
    : null

  const selectedTask = selectedId
    ? tasks.find((t) => t.id === selectedId) ?? null
    : null

  return (
    <TaskActionsProvider value={actions}>
      <div className={`fixed inset-0 flex flex-col overflow-hidden ${t.page}`}>
        <DemoBanner />
        <div className="flex flex-1 overflow-hidden">
          <DemoSidebar />
          <main className="flex flex-1 flex-col overflow-hidden">
            <DemoTopbar count={tasks.length} />
            <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">
              <DndContext
                id="demo-board"
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
              >
                <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {groups.map((g) => {
                    const status = STATUS_BY_ID[g.key]
                    return (
                      <BoardColumn
                        key={g.key}
                        title={g.label}
                        statusId={status.id}
                        tasks={g.items}
                        selectedTaskId={selectedId}
                        onSelect={(id) => setSelectedId(id)}
                        onAdd={() => actions.addInColumn(status.id)}
                        density="cozy"
                        droppableId={`col:${status.id}`}
                      />
                    )
                  })}
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeTask ? (
                    <div className="rotate-1 opacity-95 shadow-2xl">
                      <TaskCard task={activeTask} draggable={false} density="cozy" />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </main>
        </div>
        {selectedTask && (
          <DemoTaskDrawer
            task={selectedTask}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </TaskActionsProvider>
  )
}

function DemoBanner() {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex h-10 shrink-0 items-center justify-between border-b bg-white/80 px-4 text-xs backdrop-blur ${t.border} dark:bg-[#161F1F]/80`}
    >
      <Link
        href="/"
        className={`inline-flex items-center gap-1.5 transition ${t.textMuted} hover:${t.text}`}
      >
        <ArrowLeft className="size-3.5" />
        Back to site
      </Link>
      <div
        className={`hidden items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase sm:flex ${t.textSubtle}`}
      >
        <Sparkles className="size-3" />
        Demo mode - changes reset on refresh
      </div>
      <a
        href={DEPLOY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 text-[11px] font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Deploy your own
      </a>
    </div>
  )
}

function DemoSidebar() {
  const { t } = useDashTheme()
  return (
    <aside
      className={`hidden w-56 shrink-0 flex-col gap-1 border-r p-3 text-sm sm:flex ${t.border} bg-white/40 dark:bg-white/[0.02]`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex size-6 items-center justify-center rounded bg-[#948CC0]/15 text-[10px] font-bold text-[#6E62B0] dark:bg-[#948CC0]/20 dark:text-[#BCB3DD]">
          {config.appName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex flex-col leading-none">
          <span className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}>
            {config.appName}
          </span>
          <span className={`text-xs ${t.text}`}>Workspace</span>
        </div>
      </div>

      <div className="my-2 flex flex-col gap-0.5">
        <SidebarRow icon={LayoutGrid} label="Board" active />
        <SidebarRow icon={Calendar} label="Sprints" />
        <SidebarRow icon={Bell} label="Updates" badge="3" />
        <SidebarRow icon={Calendar} label="Meetings" badge="1" />
        <SidebarRow icon={Users} label="Team" />
        <SidebarRow icon={UserPlus} label="Onboarding" />
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <SidebarRow icon={Folder} label="Projects" />
        <SidebarRow icon={Settings} label="Settings" />
      </div>
    </aside>
  )
}

function SidebarRow({
  icon: Icon,
  label,
  active = false,
  badge
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  badge?: string
}) {
  const { t } = useDashTheme()
  return (
    <button
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
        active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : `${t.textMuted} hover:bg-zinc-100 dark:hover:bg-white/5`
      }`}
    >
      <Icon className="size-3.5" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="rounded-full bg-[#948CC0]/15 px-1.5 text-[10px] text-[#6E62B0] dark:bg-[#948CC0]/25 dark:text-[#BCB3DD]">
          {badge}
        </span>
      )}
    </button>
  )
}

function DemoTopbar({ count }: { count: number }) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex h-12 shrink-0 items-center justify-between border-b bg-white/60 px-4 backdrop-blur ${t.border} dark:bg-[#161F1F]/60`}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className={`hidden sm:inline ${t.textSubtle}`}>
          {config.appName}
        </span>
        <span className={`hidden sm:inline ${t.textFaint}`}>/</span>
        <button
          className={`inline-flex items-center gap-1 ${t.text}`}
          title="Switch project (demo)"
        >
          {DEMO_PROJECT.name}
          <ChevronDown className="size-3" />
        </button>
        <span className="ml-2 rounded-full bg-[#948CC0]/12 px-2 py-0.5 text-[10px] font-medium tracking-[0.18em] uppercase text-[#6E62B0] dark:bg-[#948CC0]/15 dark:text-[#BCB3DD]">
          {DEMO_SPRINT.name}
        </span>
      </div>
      <span className={`text-[10px] tracking-[0.18em] uppercase ${t.textSubtle}`}>
        {count} tasks
      </span>
    </div>
  )
}

function DemoTaskDrawer({
  task,
  onClose
}: {
  task: BoardTask
  onClose: () => void
}) {
  const { t } = useDashTheme()
  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm"
      />
      <aside
        className={`flex w-full max-w-md shrink-0 flex-col overflow-hidden border-l bg-white shadow-2xl sm:w-[440px] ${t.border} dark:bg-[#161F1F]`}
      >
        <div
          className={`flex items-center justify-between border-b px-5 py-3 text-xs ${t.border}`}
        >
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#948CC0]/10 px-1.5 py-0.5 font-medium text-[#6E62B0] dark:bg-[#948CC0]/15 dark:text-[#BCB3DD]">
              {task.ref}
            </span>
            <span className={t.textMuted}>
              {STATUS_BY_ID[task.status].label}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`rounded-md px-2 py-1 transition ${t.textMuted} hover:bg-zinc-100 dark:hover:bg-white/5`}
          >
            Close
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <h2 className={`text-xl leading-tight ${t.text}`}>{task.title}</h2>
          {task.description && (
            <p className={`text-sm leading-relaxed ${t.textMuted}`}>
              {task.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <FieldPair label="Assignee">
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: task.assignee.color }}
                    className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  >
                    {task.assignee.initials}
                  </span>
                  <span className={t.text}>{task.assignee.name}</span>
                </div>
              ) : (
                <span className={t.textFaint}>Unassigned</span>
              )}
            </FieldPair>
            <FieldPair label="Priority">
              <span className={t.text}>{task.priority}</span>
            </FieldPair>
            {task.due && (
              <FieldPair label="Due">
                <span className={t.text}>{task.due}</span>
              </FieldPair>
            )}
            {task.tags && task.tags.length > 0 && (
              <FieldPair label="Labels">
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((l) => (
                    <span
                      key={l}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${t.textMuted} bg-zinc-100 dark:bg-white/5`}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </FieldPair>
            )}
          </div>
          {task.checklist && task.checklist.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={`text-[10px] tracking-[0.2em] uppercase ${t.textFaint}`}>
                Checklist
              </span>
              <ul className="flex flex-col gap-1.5">
                {task.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`flex size-4 items-center justify-center rounded border ${
                        item.done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : `border-zinc-300 dark:border-white/15`
                      }`}
                      aria-hidden
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span
                      className={item.done ? `${t.textFaint} line-through` : t.text}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={`text-[11px] ${t.textFaint}`}>
            Comments, activity, and attachments are shown in the real product
            but omitted here for brevity. Ref: {task.ref}.
          </p>
        </div>
      </aside>
    </div>
  )
}

function FieldPair({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-[10px] tracking-[0.2em] uppercase ${t.textFaint}`}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  )
}

// Utility class the DashboardShell uses. Keep the demo's board wrap
// consistent with that so it matches production visuals.
