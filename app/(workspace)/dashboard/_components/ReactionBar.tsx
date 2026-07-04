'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { useDashTheme } from './theme'

const Picker = dynamic(() => import('@emoji-mart/react'), {
  ssr: false,
  loading: () => null
})

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👀']

export interface ReactionView {
  id: string
  emoji: string
  memberId: string
  memberName: string | null
}

interface ReactionBarProps {
  reactions: ReactionView[]
  currentMemberId: string
  onToggle: (emoji: string) => Promise<void> | void
  disabled?: boolean
  size?: 'sm' | 'md'
  // When true, the "+ add reaction" trigger fades in only on hover or
  // keyboard focus of the parent (parent must have `group` class).
  // Existing reaction pills stay visible. Slack-style.
  hideAddUntilHover?: boolean
}

interface Grouped {
  emoji: string
  count: number
  reactedByMe: boolean
  reactorNames: string[]
}

function groupReactions(
  reactions: ReactionView[],
  currentMemberId: string
): Grouped[] {
  const byEmoji = new Map<string, Grouped>()
  for (const r of reactions) {
    const existing = byEmoji.get(r.emoji)
    if (existing) {
      existing.count += 1
      if (r.memberId === currentMemberId) existing.reactedByMe = true
      if (r.memberName) existing.reactorNames.push(r.memberName)
    } else {
      byEmoji.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        reactedByMe: r.memberId === currentMemberId,
        reactorNames: r.memberName ? [r.memberName] : []
      })
    }
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}

export function ReactionBar({
  reactions,
  currentMemberId,
  onToggle,
  disabled,
  size = 'sm',
  hideAddUntilHover = false
}: ReactionBarProps) {
  const { t } = useDashTheme()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const grouped = useMemo(
    () => groupReactions(reactions, currentMemberId),
    [reactions, currentMemberId]
  )
  const pillH = size === 'md' ? 'h-7' : 'h-6'
  const pillText = size === 'md' ? 'text-xs' : 'text-[11px]'

  // No transition wrapping. The parent's setState runs synchronously so the
  // pill flips instantly; the network call happens in the background and
  // rolls back on error. Disabling on `disabled` prop only.
  const fire = (emoji: string) => {
    if (disabled) return
    onToggle(emoji)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => fire(g.emoji)}
          disabled={disabled}
          title={g.reactorNames.length ? g.reactorNames.join(', ') : g.emoji}
          className={`${pillH} ${pillText} group inline-flex items-center gap-1 rounded-full border px-2 transition duration-150 will-change-transform hover:scale-110 disabled:opacity-50 ${
            g.reactedByMe
              ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
              : `${t.btn}`
          }`}
        >
          <span className="text-[13px] leading-none">{g.emoji}</span>
          {g.count > 1 && <span className="tabular-nums">{g.count}</span>}
        </button>
      ))}

      <div
        className={`relative ${
          hideAddUntilHover
            ? 'opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100'
            : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setShowQuick((v) => !v)}
          disabled={disabled}
          aria-label="Add reaction"
          title="Add reaction"
          className={`${pillH} inline-flex items-center justify-center rounded-full border px-1.5 transition hover:scale-110 disabled:opacity-50 ${t.btn}`}
        >
          <SmilePlus className="size-3" />
        </button>

        {showQuick && (
          <div
            className={`absolute bottom-full left-0 z-30 mb-1 flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-lg ${t.detail} animate-in fade-in slide-in-from-bottom-1 duration-150`}
            onMouseLeave={() => setShowQuick(false)}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  fire(e)
                  setShowQuick(false)
                }}
                className="rounded-full p-1 text-base transition hover:scale-125"
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPickerOpen(true)
                setShowQuick(false)
              }}
              aria-label="More emojis"
              className={`flex size-6 items-center justify-center rounded-full border ${t.btn}`}
            >
              <SmilePlus className="size-3" />
            </button>
          </div>
        )}

        {pickerOpen && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center"
            onClick={() => setPickerOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Picker
                onEmojiSelect={(picked: { native: string }) => {
                  fire(picked.native)
                  setPickerOpen(false)
                }}
                theme="auto"
                previewPosition="none"
                searchPosition="sticky"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
