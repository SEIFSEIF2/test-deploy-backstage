'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Lock, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { invokePluginAction } from '@/app/(workspace)/dashboard/plugin-actions'
import type { PluginPanelProps } from '@/lib/plugins/types'
import type { CreatePollInput, PollView } from './shared'

async function call<T>(action: string, payload?: unknown): Promise<T> {
  const result = await invokePluginAction('polls', action, payload)
  if ('error' in result) throw new Error(result.error)
  return result.data as T
}

export default function PollsPanel({ member }: PluginPanelProps) {
  const queryClient = useQueryClient()
  const canCreate = member.accessTier !== 'member'

  const { data: polls, isLoading } = useQuery({
    queryKey: ['plugin:polls'],
    queryFn: () => call<PollView[]>('listPolls'),
    refetchOnWindowFocus: false
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['plugin:polls'] })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Polls</h2>
          <p className="text-muted-foreground text-sm">
            Quick team decisions with live results.
          </p>
        </div>
        {canCreate && <CreatePollButton onCreated={refresh} />}
      </div>

      {isLoading && (
        <div className="text-muted-foreground py-16 text-center text-sm">
          Loading polls…
        </div>
      )}
      {!isLoading && (polls?.length ?? 0) === 0 && (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          No polls yet.
          {canCreate ? ' Create the first one.' : ' Ask a lead to create one.'}
        </div>
      )}

      {(polls ?? []).map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          member={member}
          onChange={refresh}
        />
      ))}
    </div>
  )
}

function PollCard({
  poll,
  member,
  onChange
}: {
  poll: PollView
  member: PluginPanelProps['member']
  onChange: () => void
}) {
  const [pending, startTransition] = useTransition()
  const closed = Boolean(poll.closedAt)
  const canClose =
    !closed && (poll.createdBy === member.id || member.accessTier === 'admin')

  function voteFor(optionIndex: number) {
    if (closed || pending) return
    startTransition(async () => {
      try {
        await call('vote', { pollId: poll.id, optionIndex })
        onChange()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Vote failed.')
      }
    })
  }

  function close() {
    startTransition(async () => {
      try {
        await call('closePoll', { pollId: poll.id })
        onChange()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not close.')
      }
    })
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{poll.question}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {poll.creatorName} ·{' '}
            {new Date(poll.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric'
            })}
            {' · '}
            {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
            {closed && (
              <span className="ml-1 inline-flex items-center gap-1">
                <Lock className="size-3" /> closed
              </span>
            )}
          </p>
        </div>
        {canClose && (
          <Button variant="ghost" size="sm" onClick={close} disabled={pending}>
            Close
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((option, i) => {
          const count = poll.votes[i] ?? 0
          const pct =
            poll.totalVotes === 0
              ? 0
              : Math.round((count / poll.totalVotes) * 100)
          const mine = poll.myVote === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => voteFor(i)}
              disabled={closed || pending}
              className={`relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition ${
                mine ? 'border-teal-500/60' : 'hover:bg-muted/50'
              } ${closed ? 'cursor-default' : ''}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-teal-500/10"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {mine && <Check className="size-3.5 text-teal-600" />}
                  {option}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {pct}% ({count})
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CreatePollButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [pending, startTransition] = useTransition()

  function submit() {
    const payload: CreatePollInput = {
      question: question.trim(),
      options: options.map((o) => o.trim()).filter(Boolean)
    }
    startTransition(async () => {
      try {
        await call('createPoll', payload)
        toast.success('Poll created')
        setOpen(false)
        setQuestion('')
        setOptions(['', ''])
        onCreated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create.')
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> New poll
      </Button>
    )
  }

  return (
    <div className="bg-card fixed inset-x-4 top-20 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-lg border p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">New poll</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <Input
        placeholder="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={200}
      />
      {options.map((option, i) => (
        <Input
          key={i}
          placeholder={`Option ${i + 1}`}
          value={option}
          onChange={(e) =>
            setOptions((prev) =>
              prev.map((o, j) => (j === i ? e.target.value : o))
            )
          }
          maxLength={80}
        />
      ))}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={options.length >= 8}
          onClick={() => setOptions((prev) => [...prev, ''])}
        >
          Add option
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={
            pending ||
            question.trim().length === 0 ||
            options.filter((o) => o.trim()).length < 2
          }
        >
          {pending ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  )
}
