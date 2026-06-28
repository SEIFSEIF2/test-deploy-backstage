'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  FileText,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X
} from 'lucide-react'
import type { BoardTask, Sprint, SprintStatus } from './boardData'
import {
  addTaskToSprint,
  bulkMoveTasksToSprint,
  createSprint,
  deleteSprint,
  endSprint,
  listProjectSprintsForMove,
  removeTaskFromSprint,
  startSprint,
  updateSprint
} from '../actions'
import { useDashTheme } from './theme'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface SprintsPanelProps {
  projectId: string
  sprints: Sprint[]
  // Lifted setter from DashboardShell so a drag/drop can update the parent's
  // sprints state synchronously (true optimistic UI). The server confirms in
  // the background; on error we restore from the snapshot.
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>
  tasks: BoardTask[]
  // Other (non-archived) projects visible to the viewer. Used by the
  // bulk-move picker as destination project options.
  otherProjects: { id: string; name: string }[]
  accessTier: 'admin' | 'lead' | 'member'
  onOpenTask: (taskId: string) => void
  // Optional per-sprint copy-button factory. DashboardShell owns the export
  // context and injects a CopyButton per sprint.
  renderSprintCopySlot?: (sprintId: string) => React.ReactNode
}

const STATUS_META: Record<
  SprintStatus,
  { label: string; icon: typeof CheckCircle2 }
> = {
  upcoming: { label: 'Upcoming', icon: CircleDashed },
  current: { label: 'Current', icon: Loader2 },
  completed: { label: 'Completed', icon: CheckCircle2 }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((to - from) / 86400000)
}

// Re-derive scope/progress numbers locally after an optimistic taskIds
// edit. Mirrors the math in mappers.ts mapSprint so the hero + cards
// update instantly without waiting for a server refresh.
function recomputeSprintCounts(
  sprint: Sprint,
  taskIds: string[],
  allTasks: BoardTask[]
): Sprint {
  const inSprint = allTasks.filter((task) => taskIds.includes(task.id))
  const scope = inSprint.length
  const startedCount = inSprint.filter(
    (task) => task.status !== 'backlog' && task.status !== 'unscoped'
  ).length
  const completedCount = inSprint.filter(
    (task) => task.status === 'done'
  ).length
  return {
    ...sprint,
    taskIds,
    scope,
    startedCount,
    startedPct: scope ? Math.round((startedCount / scope) * 100) : 0,
    completedCount,
    completedPct: scope ? Math.round((completedCount / scope) * 100) : 0,
    percent: scope ? Math.round((completedCount / scope) * 100) : 0
  }
}

export default function SprintsPanel({
  projectId,
  sprints,
  setSprints,
  tasks,
  otherProjects,
  accessTier,
  onOpenTask,
  renderSprintCopySlot
}: SprintsPanelProps) {
  const { t } = useDashTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const canEdit = accessTier === 'admin' || accessTier === 'lead'
  const [pending, startTransition] = useTransition()
  // Sprint rows + the board's SprintHero both come from React Query
  // (DashboardChrome -> fetchInitial -> initial.sprints). router.refresh
  // alone won't reflect a status/date/title change - we have to invalidate
  // the cache so the chrome refetches.
  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboardInitial'] })
    router.refresh()
  }
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Sprint | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Sprints come pre-sorted by (status asc, number desc) from the server.
  // For the planning view we want chronological-ish order: current first,
  // then upcoming (low → high number), then completed (most recent first).
  const sortedSprints = useMemo(() => {
    const order: Record<SprintStatus, number> = {
      current: 0,
      upcoming: 1,
      completed: 2
    }
    return [...sprints].sort((a, b) => {
      const so = order[a.status] - order[b.status]
      if (so !== 0) return so
      if (a.status === 'completed') return b.number - a.number
      return a.number - b.number
    })
  }, [sprints])

  const scheduledTaskIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of sprints) for (const id of c.taskIds) s.add(id)
    return s
  }, [sprints])

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !scheduledTaskIds.has(task.id)),
    [tasks, scheduledTaskIds]
  )

  const handleCreate = (input: {
    name: string
    goal: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
  }) => {
    startTransition(async () => {
      const res = await createSprint({
        projectId,
        name: input.name,
        goal: input.goal.trim() || null,
        description: input.description.trim() || null,
        docUrl: input.docUrl.trim() || null,
        fromDate: input.fromDate,
        toDate: input.toDate
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (res.sprint) {
        const row = res.sprint
        const optimistic: Sprint = {
          id: row.id,
          projectId: row.project_id,
          number: row.number,
          name: row.name,
          goal: row.goal,
          description: row.description,
          docUrl: row.doc_url,
          status: row.status,
          from: row.from_date,
          to: row.to_date,
          fromIso: row.from_date,
          toIso: row.to_date,
          startedAtIso: row.started_at,
          closedAtIso: row.closed_at,
          shippedCount: row.shipped_count,
          carriedCount: row.carried_count,
          scope: 0,
          startedCount: 0,
          startedPct: 0,
          completedCount: 0,
          completedPct: 0,
          percent: 0,
          taskIds: [],
          carryCountByTaskId: {}
        }
        setSprints((prev) => [...prev, optimistic])
      }
      toast.success('Sprint created.')
      setShowNew(false)
      refreshDashboard()
    })
  }

  const handleUpdate = (
    sprintId: string,
    input: {
      name: string
      goal: string
      description: string
      docUrl: string
      fromDate: string
      toDate: string
    }
  ) => {
    const patch = {
      name: input.name,
      goal: input.goal.trim() || null,
      description: input.description.trim() || null,
      docUrl: input.docUrl.trim() || null,
      fromIso: input.fromDate,
      toIso: input.toDate,
      from: input.fromDate,
      to: input.toDate
    }
    setSprints((prev) =>
      prev.map((s) => (s.id === sprintId ? { ...s, ...patch } : s))
    )
    setEditingId(null)
    startTransition(async () => {
      const res = await updateSprint({
        sprintId,
        name: input.name,
        goal: input.goal.trim() || null,
        description: input.description.trim() || null,
        docUrl: input.docUrl.trim() || null,
        fromDate: input.fromDate,
        toDate: input.toDate
      })
      if ('error' in res) {
        toast.error(res.error)
        refreshDashboard()
        return
      }
      toast.success('Sprint updated.')
      refreshDashboard()
    })
  }

  const [pendingStartId, setPendingStartId] = useState<string | null>(null)
  const [pendingEnd, setPendingEnd] = useState<Sprint | null>(null)
  const [endGoalMet, setEndGoalMet] = useState(true)

  const handleStart = (sprint: Sprint) => {
    setPendingStartId(sprint.id)
    startTransition(async () => {
      const res = await startSprint(sprint.id)
      setPendingStartId(null)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Sprint ${sprint.number} started.`)
      refreshDashboard()
    })
  }

  const handleBulkMove = (input: {
    taskIds: string[]
    targetProjectId: string
    targetSprintId: string | null
  }): Promise<{ ok: boolean; moved: number; errors: number }> => {
    const moving = new Set(input.taskIds)
    setSprints((prev) =>
      prev.map((s) =>
        s.taskIds.some((id) => moving.has(id))
          ? recomputeSprintCounts(
              s,
              s.taskIds.filter((id) => !moving.has(id)),
              tasks
            )
          : s
      )
    )
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await bulkMoveTasksToSprint(input)
        if ('error' in res) {
          toast.error(res.error)
          refreshDashboard()
          resolve({ ok: false, moved: 0, errors: input.taskIds.length })
          return
        }
        const errorCount = res.errors.length
        if (errorCount > 0) {
          toast.warning(
            `Moved ${res.moved} task${res.moved === 1 ? '' : 's'}, ${errorCount} failed.`
          )
        } else {
          toast.success(
            `Moved ${res.moved} task${res.moved === 1 ? '' : 's'}.`
          )
        }
        refreshDashboard()
        resolve({ ok: true, moved: res.moved, errors: errorCount })
      })
    })
  }

  const confirmEnd = () => {
    if (!pendingEnd) return
    const target = pendingEnd
    const goalMet = endGoalMet
    startTransition(async () => {
      const res = await endSprint({ sprintId: target.id, goalMet })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Sprint ${target.number} ended - ${res.shipped} shipped, ${res.carried} carried.`
      )
      setPendingEnd(null)
      setEndGoalMet(true)
      refreshDashboard()
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setSprints((prev) => prev.filter((s) => s.id !== target.id))
    setPendingDelete(null)
    startTransition(async () => {
      const res = await deleteSprint(target.id)
      if ('error' in res) {
        toast.error(res.error)
        refreshDashboard()
        return
      }
      toast.success('Sprint deleted.')
      refreshDashboard()
    })
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(e.active.id as string)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const taskId = e.active.id as string
    const overId = e.over?.id
    if (!overId || typeof overId !== 'string') return
    if (!overId.startsWith('sprint-')) return
    const sprintId = overId.slice('sprint-'.length)

    // No-op if the task is already in this sprint.
    const targetSprint = sprints.find((c) => c.id === sprintId)
    if (!targetSprint || targetSprint.taskIds.includes(taskId)) return

    // Snapshot for rollback, then optimistically add the task to the
    // target sprint (and remove from any other sprint — a task can only
    // belong to one at a time in this UX).
    setSprints((cur) => {
      return cur.map((c) => {
        if (c.id === sprintId) {
          if (c.taskIds.includes(taskId)) return c
          const taskIds = [...c.taskIds, taskId]
          return recomputeSprintCounts(c, taskIds, tasks)
        }
        if (c.taskIds.includes(taskId)) {
          const taskIds = c.taskIds.filter((id) => id !== taskId)
          return recomputeSprintCounts(c, taskIds, tasks)
        }
        return c
      })
    })

    startTransition(async () => {
      const res = await addTaskToSprint({ sprintId, taskId })
      if ('error' in res) {
        toast.error(res.error)
        // Rollback by re-fetching the server's authoritative state.
        refreshDashboard()
        return
      }
      // Don't refresh on success — the optimistic state already matches
      // what the server now has. Refreshing would just cause a flash.
    })
  }

  const handleRemoveTask = (sprintId: string, taskId: string) => {
    // Optimistic remove first.
    setSprints((cur) =>
      cur.map((c) => {
        if (c.id !== sprintId) return c
        const taskIds = c.taskIds.filter((id) => id !== taskId)
        return recomputeSprintCounts(c, taskIds, tasks)
      })
    )
    startTransition(async () => {
      const res = await removeTaskFromSprint({ sprintId, taskId })
      if ('error' in res) {
        toast.error(res.error)
        refreshDashboard()
      }
    })
  }

  const activeDragTask = activeDragId
    ? (tasks.find((task) => task.id === activeDragId) ?? null)
    : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="h-full overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          <header className="flex items-baseline justify-between">
            <div>
              <h2 className={`text-2xl font-medium ${t.text}`}>Sprints</h2>
              <p className={`mt-1 text-sm ${t.textMuted}`}>
                Plan sprints for this project. Set a description as the
                Definition of Done, mark one as Current, and drag tasks into a
                sprint to scope it.
              </p>
            </div>
            {canEdit && !showNew && (
              <button
                onClick={() => setShowNew(true)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
              >
                <Plus className="size-3.5" /> New sprint
              </button>
            )}
          </header>

          {canEdit && showNew && (
            <SprintForm
              initial={{
                name: '',
                goal: '',
                description: '',
                docUrl: '',
                fromDate: todayIso(),
                toDate: addDaysIso(todayIso(), 6)
              }}
              submitLabel="Create sprint"
              submitting={pending}
              onSubmit={handleCreate}
              onCancel={() => setShowNew(false)}
            />
          )}

          <AlertDialog
            open={pendingDelete !== null}
            onOpenChange={(open) => {
              if (!open && !pending) setPendingDelete(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingDelete
                    ? `"${pendingDelete.name}" will be removed. Its tasks stay in the project - they just go back to Unscheduled.`
                    : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault()
                    confirmDelete()
                  }}
                >
                  {pending ? 'Deleting…' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingEnd !== null}
            onOpenChange={(open) => {
              if (!open && !pending) {
                setPendingEnd(null)
                setEndGoalMet(true)
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End this sprint?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col gap-2 text-sm">
                    {pendingEnd ? (
                      <>
                        <div>
                          <span className="font-medium">{pendingEnd.name}</span>{' '}
                          will be marked completed. Unfinished tasks roll into the
                          next sprint with a <em>Carried</em> badge.
                        </div>
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                            <span>{pendingEnd.completedCount} done · will be archived to this sprint card</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <RefreshCw className="size-3.5 text-rose-500" />
                            <span>
                              {Math.max(
                                0,
                                pendingEnd.scope - pendingEnd.completedCount
                              )}{' '}
                              carry to the next sprint
                            </span>
                          </div>
                        </div>
                        {pendingEnd.goal && (
                          <label className="mt-1 flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={endGoalMet}
                              onChange={(e) => setEndGoalMet(e.target.checked)}
                              disabled={pending}
                            />
                            <span>
                              Goal met:{' '}
                              <span className="italic">{pendingEnd.goal}</span>
                            </span>
                          </label>
                        )}
                      </>
                    ) : null}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault()
                    confirmEnd()
                  }}
                >
                  {pending ? 'Ending…' : 'End sprint'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="flex flex-col gap-3">
              {sortedSprints.length === 0 ? (
                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center ${t.border}`}
                >
                  <p className={`text-sm ${t.text}`}>No sprints yet</p>
                  <p className={`max-w-sm text-xs ${t.textMuted}`}>
                    {canEdit
                      ? 'Click "New sprint" to plan the first one.'
                      : 'Sprints will show up here once an admin or lead creates one.'}
                  </p>
                </div>
              ) : (
                sortedSprints.map((sprint) => {
                  const tasksInSprint = tasks.filter((task) =>
                    sprint.taskIds.includes(task.id)
                  )
                  return (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      tasksInSprint={tasksInSprint}
                      canEdit={canEdit}
                      isEditing={editingId === sprint.id}
                      submitting={pending}
                      starting={pendingStartId === sprint.id}
                      otherProjects={otherProjects}
                      onStartEdit={() => setEditingId(sprint.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(input) => handleUpdate(sprint.id, input)}
                      onDelete={() => setPendingDelete(sprint)}
                      onStart={() => handleStart(sprint)}
                      onEnd={() => {
                        setEndGoalMet(true)
                        setPendingEnd(sprint)
                      }}
                      onOpenTask={onOpenTask}
                      onRemoveTask={(taskId) =>
                        handleRemoveTask(sprint.id, taskId)
                      }
                      onBulkMove={handleBulkMove}
                      copySlot={renderSprintCopySlot?.(sprint.id)}
                    />
                  )
                })
              )}
            </div>

            <UnscheduledColumn
              tasks={unscheduledTasks}
              canEdit={canEdit}
              onOpenTask={onOpenTask}
            />
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          <div
            className={`flex w-64 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs shadow-2xl ${t.surface} ${t.border}`}
          >
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
            >
              {activeDragTask.ref}
            </span>
            <span className={`truncate ${t.text}`}>{activeDragTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

type ProjectSprintForMove = {
  id: string
  name: string
  number: number
  status: 'upcoming' | 'current' | 'completed'
  fromIso: string
  toIso: string
}

function SprintCard({
  sprint,
  tasksInSprint,
  canEdit,
  isEditing,
  submitting,
  starting,
  otherProjects,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onStart,
  onEnd,
  onOpenTask,
  onRemoveTask,
  onBulkMove,
  copySlot
}: {
  sprint: Sprint
  tasksInSprint: BoardTask[]
  canEdit: boolean
  isEditing: boolean
  submitting: boolean
  starting: boolean
  otherProjects: { id: string; name: string }[]
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (input: {
    name: string
    goal: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
  }) => void
  onDelete: () => void
  onStart: () => void
  onEnd: () => void
  onOpenTask: (id: string) => void
  onRemoveTask: (taskId: string) => void
  onBulkMove: (input: {
    taskIds: string[]
    targetProjectId: string
    targetSprintId: string | null
  }) => Promise<{ ok: boolean; moved: number; errors: number }>
  copySlot?: React.ReactNode
}) {
  const { t } = useDashTheme()
  const { setNodeRef, isOver } = useDroppable({ id: `sprint-${sprint.id}` })

  const meta = STATUS_META[sprint.status]
  const Icon = meta.icon

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<string>('')
  const [moveTargetSprintId, setMoveTargetSprintId] = useState<string>('')
  const [moveTargetSprints, setMoveTargetSprints] = useState<
    ProjectSprintForMove[]
  >([])
  const [sprintsLoading, setSprintsLoading] = useState(false)
  const [movePending, setMovePending] = useState(false)

  const toggleTaskSelected = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setMoveTargetProjectId('')
    setMoveTargetSprintId('')
    setMoveTargetSprints([])
  }

  const handleProjectPicked = async (pid: string) => {
    setMoveTargetProjectId(pid)
    setMoveTargetSprintId('')
    setMoveTargetSprints([])
    if (!pid) return
    setSprintsLoading(true)
    const res = await listProjectSprintsForMove({ projectId: pid })
    setSprintsLoading(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setMoveTargetSprints(res.sprints)
  }

  const handleMove = async () => {
    if (!moveTargetProjectId || selectedIds.size === 0) return
    setMovePending(true)
    const result = await onBulkMove({
      taskIds: [...selectedIds],
      targetProjectId: moveTargetProjectId,
      targetSprintId: moveTargetSprintId || null
    })
    setMovePending(false)
    if (result.ok && result.errors === 0) exitSelectMode()
  }

  if (isEditing && canEdit) {
    return (
      <SprintForm
        initial={{
          name: sprint.name,
          goal: sprint.goal ?? '',
          description: sprint.description ?? '',
          docUrl: sprint.docUrl ?? '',
          fromDate: sprint.fromIso,
          toDate: sprint.toIso
        }}
        submitLabel="Save"
        submitting={submitting}
        onSubmit={onSave}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-xl border p-4 transition ${t.column} ${
        isOver
          ? 'border-teal-500 bg-teal-500/4 ring-2 ring-teal-500/30 dark:bg-teal-500/10'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t.metaTag}`}
            >
              <Icon
                className={`size-3 ${sprint.status === 'current' ? 'animate-spin' : ''}`}
              />
              {meta.label}
            </span>
            <span className={`text-[10px] ${t.textSubtle}`}>
              #{sprint.number}
            </span>
          </div>
          <h3 className={`text-sm font-medium ${t.text}`}>{sprint.name}</h3>
          {sprint.goal && (
            <p className={`text-[11px] leading-snug ${t.textMuted}`}>
              {sprint.goal}
            </p>
          )}
          {sprint.description && (
            <details className={`text-[11px] ${t.textMuted}`}>
              <summary
                className={`cursor-pointer list-none text-[10px] tracking-wider uppercase ${t.textSubtle} hover:opacity-80 [&::-webkit-details-marker]:hidden`}
              >
                Definition of Done <span className="opacity-60">(click to expand)</span>
              </summary>
              <p
                className={`mt-1.5 leading-snug whitespace-pre-line ${t.textMuted}`}
              >
                {sprint.description}
              </p>
            </details>
          )}
          {sprint.status === 'completed' && (
            <div className={`mt-1 flex items-center gap-2 text-[11px] ${t.textMuted}`}>
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>
                Shipped: {sprint.shippedCount ?? sprint.completedCount} · Carried:{' '}
                {sprint.carriedCount ?? 0}
              </span>
            </div>
          )}
          <div
            className={`mt-1 flex items-center gap-1.5 text-[11px] ${t.textMuted}`}
          >
            <CalendarRange className="size-3" />
            <span>
              {sprint.from} → {sprint.to}
            </span>
            <span className={t.textSubtle}>
              · {Math.max(0, daysBetween(sprint.fromIso, sprint.toIso) + 1)}d
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {sprint.docUrl && (
            <a
              href={sprint.docUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="Open plan doc"
              className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
            >
              <FileText className="size-3.5" />
            </a>
          )}
          {copySlot}
          {canEdit && sprint.status === 'upcoming' && (
            <button
              onClick={onStart}
              disabled={submitting}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.accent}`}
            >
              {starting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              Start sprint
            </button>
          )}
          {canEdit && sprint.status === 'current' && (
            <button
              onClick={onEnd}
              disabled={submitting}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.btn}`}
            >
              <Square className="size-3" />
              End sprint
            </button>
          )}
          {canEdit && tasksInSprint.length > 0 && otherProjects.length > 0 && (
            <button
              onClick={() =>
                selectMode ? exitSelectMode() : setSelectMode(true)
              }
              disabled={submitting}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${
                selectMode ? t.tabActive : t.btn
              }`}
            >
              <CheckCircle2 className="size-3" />
              {selectMode ? 'Cancel select' : 'Select'}
            </button>
          )}
          {canEdit && (
            <>
              <button
                onClick={onStartEdit}
                disabled={submitting}
                className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${t.btn}`}
                aria-label="Edit sprint"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={onDelete}
                disabled={submitting}
                className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${t.btn} ${t.accentText}`}
                aria-label="Delete sprint"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${t.textMuted}`}>
          {sprint.scope === 0
            ? 'No tasks scheduled'
            : `${sprint.completedCount}/${sprint.scope} done`}
        </span>
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {sprint.percent}%
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${sprint.percent}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1">
        {tasksInSprint.length === 0 ? (
          <li
            className={`rounded-md border border-dashed px-3 py-3 text-center text-[11px] italic transition ${
              isOver
                ? 'border-teal-500 text-teal-600 dark:text-teal-300'
                : `${t.border} ${t.textSubtle}`
            }`}
          >
            {isOver
              ? 'Release to add to this sprint'
              : 'Drop a task here to scope it into this sprint'}
          </li>
        ) : (
          tasksInSprint.map((task) => {
            const carryCount = sprint.carryCountByTaskId[task.id] ?? 0
            const checked = selectedIds.has(task.id)
            return (
              <li
                key={task.id}
                className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${t.column} ${
                  selectMode && checked
                    ? 'ring-2 ring-teal-500/40'
                    : ''
                }`}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTaskSelected(task.id)}
                    className="size-3.5 shrink-0 accent-teal-500"
                    aria-label={`Select ${task.ref}`}
                  />
                )}
                <button
                  onClick={() =>
                    selectMode ? toggleTaskSelected(task.id) : onOpenTask(task.id)
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
                  >
                    {task.ref}
                  </span>
                  <span className={`truncate ${t.text}`}>{task.title}</span>
                  {carryCount > 0 && (
                    <span
                      title={`Carried ${carryCount} time${carryCount === 1 ? '' : 's'} from previous sprints`}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[9px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      <RefreshCw className="size-2.5" />
                      Carried {carryCount}x
                    </span>
                  )}
                </button>
                {canEdit && !selectMode && (
                  <button
                    onClick={() => onRemoveTask(task.id)}
                    className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
                    aria-label="Remove from sprint"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            )
          })
        )}
        {tasksInSprint.length > 0 && isOver && (
          <li
            className={`rounded-md border border-dashed border-teal-500 px-2.5 py-1.5 text-center text-[11px] text-teal-600 italic dark:text-teal-300`}
          >
            Release to add here
          </li>
        )}
      </ul>

      {selectMode && (
        <div
          className={`flex flex-col gap-2 rounded-md border-2 border-dashed p-3 ${t.surfaceMuted} border-teal-400/60`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-medium ${t.text}`}>
              {selectedIds.size === 0
                ? 'Pick tasks to move...'
                : `${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'} selected`}
            </span>
            {tasksInSprint.length > 0 && (
              <button
                onClick={() => {
                  if (selectedIds.size === tasksInSprint.length) {
                    setSelectedIds(new Set())
                  } else {
                    setSelectedIds(new Set(tasksInSprint.map((t) => t.id)))
                  }
                }}
                className={`text-[10px] underline ${t.textMuted}`}
              >
                {selectedIds.size === tasksInSprint.length
                  ? 'Clear all'
                  : 'Select all'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span
                className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
              >
                To project
              </span>
              <select
                value={moveTargetProjectId}
                onChange={(e) => handleProjectPicked(e.target.value)}
                disabled={movePending || selectedIds.size === 0}
                className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
              >
                <option value="">Pick a project...</option>
                {otherProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span
                className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
              >
                Into sprint
              </span>
              <select
                value={moveTargetSprintId}
                onChange={(e) => setMoveTargetSprintId(e.target.value)}
                disabled={
                  movePending ||
                  !moveTargetProjectId ||
                  sprintsLoading
                }
                className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
              >
                <option value="">
                  {sprintsLoading
                    ? 'Loading...'
                    : moveTargetSprints.length === 0 && moveTargetProjectId
                      ? 'No open sprints - leave Unscheduled'
                      : 'Unscheduled (no sprint)'}
                </option>
                {moveTargetSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={exitSelectMode}
              disabled={movePending}
              className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={
                movePending ||
                selectedIds.size === 0 ||
                !moveTargetProjectId
              }
              className={`h-8 rounded-md px-3 text-xs disabled:opacity-50 ${t.accent}`}
            >
              {movePending
                ? 'Moving...'
                : `Move ${selectedIds.size || ''}`.trim()}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function UnscheduledColumn({
  tasks,
  canEdit,
  onOpenTask
}: {
  tasks: BoardTask[]
  canEdit: boolean
  onOpenTask: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <aside
      className={`flex h-fit flex-col gap-3 rounded-xl border p-4 ${t.column}`}
    >
      <header className="flex items-baseline justify-between">
        <h3
          className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
        >
          Unscheduled
        </h3>
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {tasks.length}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {tasks.length === 0 ? (
          <li className={`text-xs italic ${t.textSubtle}`}>
            All tasks are in a sprint.
          </li>
        ) : (
          tasks.map((task) => (
            <DraggableTaskRow
              key={task.id}
              task={task}
              draggable={canEdit}
              onOpenTask={onOpenTask}
            />
          ))
        )}
      </ul>
    </aside>
  )
}

function DraggableTaskRow({
  task,
  draggable,
  onOpenTask
}: {
  task: BoardTask
  draggable: boolean
  onOpenTask: (id: string) => void
}) {
  const { t } = useDashTheme()
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled: !draggable })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={() => onOpenTask(task.id)}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition select-none ${
        draggable ? 'cursor-grab' : 'cursor-pointer'
      } ${t.column} ${
        isDragging
          ? 'opacity-40'
          : 'hover:border-zinc-400 dark:hover:border-white/30'
      }`}
    >
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
      >
        {task.ref}
      </span>
      <span className={`truncate ${t.text}`}>{task.title}</span>
    </li>
  )
}

function SprintForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel
}: {
  initial: {
    name: string
    goal: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
  }
  submitLabel: string
  submitting: boolean
  onSubmit: (input: {
    name: string
    goal: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
  }) => void
  onCancel: () => void
}) {
  const { t } = useDashTheme()
  const [name, setName] = useState(initial.name)
  const [goal, setGoal] = useState(initial.goal)
  const [description, setDescription] = useState(initial.description)
  const [docUrl, setDocUrl] = useState(initial.docUrl)
  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)

  const canSubmit = name.trim().length >= 2 && fromDate <= toDate

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit({
          name: name.trim(),
          goal,
          description,
          docUrl,
          fromDate,
          toDate
        })
      }}
      className={`flex flex-col gap-3 rounded-xl border p-4 ${t.column}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-medium tracking-wider uppercase ${t.textMuted}`}
        >
          Sprint details
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={`flex size-6 items-center justify-center rounded ${t.btn}`}
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sprint name (e.g. Sprint 1)"
        className={`h-9 rounded-md border px-3 text-sm ${t.input}`}
        maxLength={80}
        required
      />

      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Goal (one sentence: what should this sprint ship?)"
        className={`h-9 rounded-md border px-3 text-sm ${t.input}`}
        maxLength={200}
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Definition of Done - longer notes (optional)"
        className={`min-h-20 resize-none rounded-md border px-3 py-2 text-xs ${t.input}`}
        maxLength={1000}
      />

      <label className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Plan doc (optional)
        </span>
        <input
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://docs.google.com/… or https://github.com/.../wiki"
          className={`h-9 rounded-md border px-3 text-xs ${t.input}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
          >
            Start
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
          >
            End
          </span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
            required
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className={`h-8 rounded-md px-3 text-xs disabled:opacity-50 ${t.accent}`}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
