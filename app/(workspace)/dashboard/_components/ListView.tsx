'use client'

import type { BoardTask } from './boardData'
import { useDashTheme } from './theme'

export default function ListView({
  tasks,
  onSelect
}: {
  tasks: BoardTask[]
  onSelect: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border ${t.column}`}
    >
      <div
        className={`grid grid-cols-[80px_1fr_120px_140px_60px_80px] gap-3 border-b px-3 py-2 text-[10px] tracking-wider uppercase ${t.textSubtle} ${t.columnHeader}`}
      >
        <span>Ref</span>
        <span>Title</span>
        <span>Status</span>
        <span>Assignee</span>
        <span>Prio</span>
        <span>Due</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`grid w-full grid-cols-[80px_1fr_120px_140px_60px_80px] items-center gap-3 border-b px-3 py-2.5 text-left text-xs transition ${t.dividerSoft} ${t.rowHover}`}
          >
            <span
              className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
            >
              {task.ref}
            </span>
            <span className={`truncate ${t.text}`}>{task.title}</span>
            <span className={t.textMuted}>{task.status.replace('_', ' ')}</span>
            <span
              className={`flex items-center gap-1.5 truncate ${t.textMuted}`}
            >
              {task.assignee ? (
                <>
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${task.assignee.color}`}
                  >
                    {task.assignee.initials}
                  </span>
                  <span className="truncate">{task.assignee.name}</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className={`capitalize ${t.textMuted}`}>{task.priority}</span>
            <span className={t.textSubtle}>{task.due ?? '—'}</span>
          </button>
        ))}
        {tasks.length === 0 && (
          <p className={`px-3 py-6 text-center text-xs italic ${t.textSubtle}`}>
            No tasks match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
