'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Inbox, LogOut } from 'lucide-react'
import { signOut } from '@/app/(authentication)/login/actions'
import type { BoardAssignee } from './boardData'
import Avatar from './Avatar'
import { useDashTheme } from './theme'

export default function CurrentUserMenu({
  user,
  updatesUnread,
  onOpenUpdates
}: {
  user: BoardAssignee
  updatesUnread: number
  onOpenUpdates: () => void
}) {
  const isAdmin = user.role === 'admin'
  const isLead = user.role === 'lead'
  const { t } = useDashTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const roleLabel = isAdmin ? 'Admin' : isLead ? 'Lead' : 'Member'
  const badgeText = updatesUnread > 9 ? '9+' : String(updatesUnread)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          updatesUnread > 0
            ? `${user.name}, ${updatesUnread} unread update${updatesUnread === 1 ? '' : 's'}`
            : user.name
        }
        title={user.name}
        className={`flex items-center gap-2 rounded-full border px-2 py-1 transition ${
          open ? t.btnActive : t.btn
        }`}
      >
        <span className="relative inline-flex">
          <Avatar user={user} size={22} />
          {updatesUnread > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white ring-2 ring-white dark:ring-zinc-900"
              aria-hidden
            >
              {badgeText}
            </span>
          )}
        </span>
        <span className={`text-xs ${t.text} hidden sm:inline`}>
          {user.name}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${
            isAdmin
              ? 'bg-teal-500/15 text-teal-500'
              : isLead
                ? 'bg-amber-500/15 text-amber-500'
                : `${t.surfaceMuted} ${t.textMuted}`
          }`}
        >
          {roleLabel}
        </span>
        <ChevronDown
          className={`size-3 ${t.textSubtle} transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-9 right-0 z-40 w-56 rounded-md border py-1 shadow-xl ${t.detail}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar user={user} size={28} />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className={`truncate text-xs font-medium ${t.text}`}>
                {user.name}
              </span>
              <span
                className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
          <div className={`my-1 border-t ${t.borderSoft}`} />
          <button
            type="button"
            onClick={() => {
              onOpenUpdates()
              setOpen(false)
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab} ${t.text}`}
          >
            <Inbox className="size-3.5" />
            <span className="flex-1">Updates</span>
            {updatesUnread > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {badgeText}
              </span>
            )}
          </button>
          <div className={`my-1 border-t ${t.borderSoft}`} />
          <form action={signOut}>
            <button
              type="submit"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab} ${t.accentText}`}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
