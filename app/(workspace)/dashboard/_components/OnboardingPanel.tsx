'use client'

import { useMemo, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Layers,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  UserMinus,
  UserPlus,
  X
} from 'lucide-react'
import {
  archiveTemplate,
  createTemplate,
  listAllTemplates,
  listMemberChecklist,
  listOnboardingProgress,
  markStep,
  seedDefaultTemplates,
  updateTemplate
} from '../actions'
import { useDashTheme } from './theme'

type AccessTier = 'admin' | 'lead' | 'member'
type StepStatus = 'pending' | 'done' | 'removed' | 'na' | 'blocked'
type MarkableStatus = 'done' | 'removed' | 'na' | 'blocked'
type Mode = 'onboard' | 'offboard'

interface Props {
  currentMemberId: string
  currentAccessTier: AccessTier
}

interface SubView {
  view: 'index' | 'member' | 'templates'
  memberId?: string
  mode?: Mode
}

export default function OnboardingPanel({
  currentMemberId,
  currentAccessTier
}: Props) {
  const [sub, setSub] = useState<SubView>({ view: 'index' })
  const isAdmin = currentAccessTier === 'admin'
  const canEditChecklist = isAdmin || currentAccessTier === 'lead'

  if (sub.view === 'member' && sub.memberId) {
    return (
      <MemberView
        memberId={sub.memberId}
        mode={sub.mode ?? 'onboard'}
        canEdit={canEditChecklist}
        currentMemberId={currentMemberId}
        onBack={() => setSub({ view: 'index' })}
        onSwitchMode={(mode) =>
          setSub({ view: 'member', memberId: sub.memberId, mode })
        }
      />
    )
  }

  if (sub.view === 'templates') {
    return (
      <TemplatesView
        isAdmin={isAdmin}
        onBack={() => setSub({ view: 'index' })}
      />
    )
  }

  return (
    <IndexView
      isAdmin={isAdmin}
      canEditChecklist={canEditChecklist}
      currentMemberId={currentMemberId}
      onOpenMember={(memberId, mode) =>
        setSub({ view: 'member', memberId, mode })
      }
      onOpenTemplates={() => setSub({ view: 'templates' })}
    />
  )
}

function IndexView({
  isAdmin,
  canEditChecklist,
  currentMemberId,
  onOpenMember,
  onOpenTemplates
}: {
  isAdmin: boolean
  canEditChecklist: boolean
  currentMemberId: string
  onOpenMember: (memberId: string, mode: Mode) => void
  onOpenTemplates: () => void
}) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [seedPending, setSeedPending] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'progress'],
    queryFn: async () => {
      const res = await listOnboardingProgress()
      if ('error' in res) throw new Error(res.error)
      return res.members
    }
  })

  const totalTemplates = useMemo(() => {
    if (!data) return 0
    return data.reduce((acc, m) => Math.max(acc, m.total), 0)
  }, [data])

  const handleSeed = async () => {
    setSeedPending(true)
    const res = await seedDefaultTemplates()
    setSeedPending(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    if ('skipped' in res) {
      toast.info('Templates already exist - nothing to seed.')
      return
    }
    toast.success(`Seeded ${res.count} starter templates.`)
    queryClient.invalidateQueries({ queryKey: ['onboarding', 'progress'] })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-medium ${t.text}`}>Onboarding</h1>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Per-member checklist for getting new joiners set up across every
            tool. Click a member to drill into their list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && totalTemplates === 0 && (
            <button
              onClick={handleSeed}
              disabled={seedPending}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.accent}`}
            >
              <Sparkles className="size-3.5" />
              {seedPending ? 'Seeding...' : 'Seed starter templates'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onOpenTemplates}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition ${t.btn}`}
            >
              <Settings2 className="size-3.5" />
              Templates
            </button>
          )}
        </div>
      </header>

      {isLoading && (
        <p className={`text-sm ${t.textMuted}`}>Loading members...</p>
      )}

      {data && data.length === 0 && (
        <div
          className={`rounded-lg border border-dashed p-8 text-center ${t.borderSoft}`}
        >
          <p className={`text-sm ${t.text}`}>No team members yet.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((m) => {
            const tone =
              m.percent === 100
                ? 'bg-emerald-500'
                : m.percent >= 60
                  ? 'bg-amber-500'
                  : m.percent === 0
                    ? 'bg-zinc-300 dark:bg-white/20'
                    : 'bg-rose-500'
            return (
              <li
                key={m.memberId}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition hover:border-zinc-400 dark:hover:border-white/30 ${t.column}`}
              >
                <button
                  onClick={() => onOpenMember(m.memberId, 'onboard')}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-medium ${t.text}`}
                      >
                        {m.fullName}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
                      >
                        {m.accessTier}
                      </span>
                      {m.memberId === currentMemberId && (
                        <span className={`text-[10px] ${t.textSubtle}`}>
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-1.5 flex-1 overflow-hidden rounded-full ${t.surfaceMuted}`}
                      >
                        <div
                          className={`h-full transition-all ${tone}`}
                          style={{ width: `${m.percent}%` }}
                        />
                      </div>
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${t.textMuted}`}
                      >
                        {m.done}/{m.total} · {m.percent}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`size-4 shrink-0 ${t.textSubtle}`} />
                </button>
                {canEditChecklist && m.done > 0 && (
                  <button
                    onClick={() => onOpenMember(m.memberId, 'offboard')}
                    title="Start offboarding"
                    className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function MemberView({
  memberId,
  mode,
  canEdit,
  currentMemberId,
  onBack,
  onSwitchMode
}: {
  memberId: string
  mode: Mode
  canEdit: boolean
  currentMemberId: string
  onBack: () => void
  onSwitchMode: (mode: Mode) => void
}) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'checklist', memberId],
    queryFn: async () => {
      const res = await listMemberChecklist(memberId)
      if ('error' in res) throw new Error(res.error)
      return res
    }
  })

  type ChecklistRow = NonNullable<typeof data>['checklist'][number]
  const grouped = useMemo(() => {
    const m = new Map<string, ChecklistRow[]>()
    if (!data) return m
    for (const row of data.checklist) {
      const list = m.get(row.category) ?? []
      list.push(row)
      m.set(row.category, list)
    }
    return m
  }, [data])

  const counts = useMemo(() => {
    if (!data) return { total: 0, done: 0, percent: 0 }
    const total = data.checklist.length
    const done = data.checklist.filter(
      (r) => r.status === 'done' || r.status === 'removed' || r.status === 'na'
    ).length
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100)
    }
  }, [data])

  const handleMark = (templateId: string, status: MarkableStatus) => {
    startTransition(async () => {
      const res = await markStep({ memberId, templateId, status })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['onboarding', 'checklist', memberId]
      })
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'progress'] })
    })
  }

  const isSelf = memberId === currentMemberId
  const canTick = canEdit
  const member = data?.member ?? null

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4 ${t.border}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
            aria-label="Back to index"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <div className="min-w-0">
            <h1 className={`truncate text-lg font-medium ${t.text}`}>
              {member?.fullName ?? 'Member'}
              {isSelf && (
                <span className={`ml-2 text-[11px] ${t.textSubtle}`}>
                  (you)
                </span>
              )}
            </h1>
            <p className={`text-[11px] ${t.textMuted}`}>
              {member &&
                `${member.accessTier} · ${member.skills.length} skills`}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 rounded-md border p-0.5 ${t.border}`}
        >
          <button
            onClick={() => onSwitchMode('onboard')}
            className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] transition ${
              mode === 'onboard' ? t.tabActive : t.tab
            }`}
          >
            <UserPlus className="size-3" />
            Onboard
          </button>
          <button
            onClick={() => onSwitchMode('offboard')}
            className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] transition ${
              mode === 'offboard' ? t.tabActive : t.tab
            }`}
          >
            <UserMinus className="size-3" />
            Offboard
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-24">
        {isLoading && (
          <p className={`text-sm ${t.textMuted}`}>Loading checklist...</p>
        )}

        {data && data.checklist.length === 0 && (
          <div
            className={`rounded-lg border border-dashed p-8 text-center ${t.borderSoft}`}
          >
            <p className={`text-sm ${t.text}`}>
              No steps match this member's tier + skills.
            </p>
          </div>
        )}

        {[...grouped.entries()].map(([category, rows]) => (
          <section key={category} className="mb-6">
            <h2
              className={`mb-2 text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
            >
              {category}
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <StepRow
                  key={r.id}
                  row={r}
                  mode={mode}
                  canTick={canTick}
                  pending={pending}
                  onMark={handleMark}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer
        className={`shrink-0 border-t px-6 py-3 ${t.border} ${t.surfaceMuted}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-1.5 flex-1 overflow-hidden rounded-full ${t.surface}`}
          >
            <div
              className={`h-full transition-all ${
                counts.percent === 100
                  ? 'bg-emerald-500'
                  : counts.percent >= 60
                    ? 'bg-amber-500'
                    : counts.percent === 0
                      ? 'bg-zinc-300 dark:bg-white/20'
                      : 'bg-rose-500'
              }`}
              style={{ width: `${counts.percent}%` }}
            />
          </div>
          <span className={`text-xs tabular-nums ${t.textMuted}`}>
            {mode === 'onboard' ? 'Onboarded' : 'Offboarded'} · {counts.done}/
            {counts.total} · {counts.percent}%
          </span>
        </div>
      </footer>
    </div>
  )
}

function StepRow({
  row,
  mode,
  canTick,
  pending,
  onMark
}: {
  row: {
    id: string
    title: string
    description: string | null
    adminInviteUrl: string | null
    memberHelpUrl: string | null
    status: StepStatus
    note: string | null
    completedAt: string | null
    completedBy: { id: string; fullName: string } | null
  }
  mode: Mode
  canTick: boolean
  pending: boolean
  onMark: (templateId: string, status: MarkableStatus) => void
}) {
  const { t } = useDashTheme()

  const StatusIcon =
    row.status === 'done' || row.status === 'removed'
      ? CheckCircle2
      : row.status === 'na'
        ? Check
        : row.status === 'blocked'
          ? AlertCircle
          : Circle

  const statusColor =
    row.status === 'done'
      ? 'text-emerald-500'
      : row.status === 'removed'
        ? 'text-zinc-400 dark:text-white/40'
        : row.status === 'na'
          ? 'text-zinc-400 dark:text-white/40'
          : row.status === 'blocked'
            ? 'text-rose-500'
            : 'text-zinc-300 dark:text-white/20'

  const inviteUrl =
    mode === 'onboard'
      ? (row.adminInviteUrl ?? row.memberHelpUrl)
      : row.adminInviteUrl

  const primaryAction =
    mode === 'onboard'
      ? row.status === 'done'
        ? null
        : ({ label: 'Mark done', status: 'done' } as const)
      : row.status === 'removed'
        ? null
        : ({ label: 'Mark removed', status: 'removed' } as const)

  return (
    <li
      className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${t.column}`}
    >
      <StatusIcon className={`mt-0.5 size-5 shrink-0 ${statusColor}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${t.text}`}>{row.title}</span>
          {row.status === 'done' && row.completedAt && (
            <span className={`text-[10px] ${t.textSubtle}`}>
              done {new Date(row.completedAt).toLocaleDateString()}
              {row.completedBy && ` · by ${row.completedBy.fullName}`}
            </span>
          )}
          {row.status === 'removed' && row.completedAt && (
            <span className={`text-[10px] ${t.textSubtle}`}>
              removed {new Date(row.completedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {row.description && (
          <p className={`text-[11px] leading-snug ${t.textMuted}`}>
            {row.description}
          </p>
        )}
        {row.note && (
          <p className={`mt-1 text-[11px] leading-snug italic ${t.textSubtle}`}>
            Note: {row.note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {inviteUrl && (
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${t.btn}`}
            title="Open admin URL"
          >
            <ExternalLink className="size-3" />
            Open
          </a>
        )}
        {canTick && primaryAction && (
          <button
            onClick={() => onMark(row.id, primaryAction.status)}
            disabled={pending}
            className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.accent}`}
          >
            {primaryAction.label}
          </button>
        )}
        {canTick && row.status === 'pending' && (
          <button
            onClick={() => onMark(row.id, 'na')}
            disabled={pending}
            className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.btn}`}
            title="Mark not applicable"
          >
            N/A
          </button>
        )}
      </div>
    </li>
  )
}

function TemplatesView({
  isAdmin,
  onBack
}: {
  isAdmin: boolean
  onBack: () => void
}) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [pending, startTransition] = useTransition()

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'templates'],
    queryFn: async () => {
      const res = await listAllTemplates()
      if ('error' in res) throw new Error(res.error)
      return res.templates
    }
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] })
    queryClient.invalidateQueries({ queryKey: ['onboarding', 'progress'] })
  }

  const handleArchive = (templateId: string) => {
    startTransition(async () => {
      const res = await archiveTemplate(templateId)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Template archived.')
      refresh()
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex shrink-0 items-center justify-between gap-3 border-b px-6 py-4 ${t.border}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
            aria-label="Back to index"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <div>
            <h1 className={`text-lg font-medium ${t.text}`}>
              Onboarding templates
            </h1>
            <p className={`text-[11px] ${t.textMuted}`}>
              Steps that get applied to members matching the tier + skill
              filter.
            </p>
          </div>
        </div>
        {isAdmin && !showNew && (
          <button
            onClick={() => setShowNew(true)}
            className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
          >
            <Plus className="size-3.5" />
            New template
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {showNew && (
          <div className="mb-4">
            <TemplateForm
              initial={null}
              submitting={pending}
              onCancel={() => setShowNew(false)}
              onSaved={() => {
                setShowNew(false)
                refresh()
              }}
            />
          </div>
        )}

        {isLoading && (
          <p className={`text-sm ${t.textMuted}`}>Loading templates...</p>
        )}

        {data && data.length === 0 && (
          <div
            className={`rounded-lg border border-dashed p-8 text-center ${t.borderSoft}`}
          >
            <p className={`text-sm ${t.text}`}>
              No templates yet. Seed the starter set from the Onboarding index.
            </p>
          </div>
        )}

        {data && data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.map((t2) => (
              <li
                key={t2.id}
                className={`flex flex-col gap-1 rounded-lg border px-4 py-3 ${t.column} ${
                  t2.archivedAt ? 'opacity-60' : ''
                }`}
              >
                {editingId === t2.id ? (
                  <TemplateForm
                    initial={t2}
                    submitting={pending}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null)
                      refresh()
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Layers className={`size-3 ${t.textSubtle}`} />
                          <span
                            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
                          >
                            {t2.category}
                          </span>
                          {t2.archivedAt && (
                            <span className="text-[10px] text-rose-500">
                              archived
                            </span>
                          )}
                        </div>
                        <h3 className={`text-sm font-medium ${t.text}`}>
                          {t2.title}
                        </h3>
                        {t2.description && (
                          <p
                            className={`text-[11px] leading-snug ${t.textMuted}`}
                          >
                            {t2.description}
                          </p>
                        )}
                        <div
                          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] ${t.textSubtle}`}
                        >
                          <span>Tiers: {t2.targetTiers.join(', ')}</span>
                          {t2.targetSkills && t2.targetSkills.length > 0 && (
                            <span>· Skills: {t2.targetSkills.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && !t2.archivedAt && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingId(t2.id)}
                            className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
                            aria-label="Edit"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => handleArchive(t2.id)}
                            disabled={pending}
                            className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${t.btn} ${t.accentText}`}
                            aria-label="Archive"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TemplateForm({
  initial,
  submitting,
  onCancel,
  onSaved
}: {
  initial: {
    id: string
    title: string
    description: string | null
    category: string
    targetTiers: AccessTier[]
    targetSkills: string[] | null
    adminInviteUrl: string | null
    memberHelpUrl: string | null
    sortOrder: number
  } | null
  submitting: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useDashTheme()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'tooling')
  const [tiers, setTiers] = useState<AccessTier[]>(
    initial?.targetTiers ?? ['member', 'lead', 'admin']
  )
  const [skillsText, setSkillsText] = useState(
    initial?.targetSkills?.join(', ') ?? ''
  )
  const [adminUrl, setAdminUrl] = useState(initial?.adminInviteUrl ?? '')
  const [helpUrl, setHelpUrl] = useState(initial?.memberHelpUrl ?? '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [busy, setBusy] = useState(false)

  const toggleTier = (tier: AccessTier) => {
    setTiers((cur) =>
      cur.includes(tier) ? cur.filter((x) => x !== tier) : [...cur, tier]
    )
  }

  const handleSubmit = async () => {
    if (title.trim().length < 2) {
      toast.error('Title must be at least 2 characters.')
      return
    }
    if (tiers.length === 0) {
      toast.error('Pick at least one access tier.')
      return
    }
    setBusy(true)
    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || 'tooling',
      targetTiers: tiers,
      targetSkills: skills.length > 0 ? skills : null,
      adminInviteUrl: adminUrl.trim() || null,
      memberHelpUrl: helpUrl.trim() || null,
      sortOrder
    }
    const res = initial
      ? await updateTemplate({ templateId: initial.id, ...payload })
      : await createTemplate(payload)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(initial ? 'Template updated.' : 'Template created.')
    onSaved()
  }

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-4 ${t.column}`}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. GitHub org invite)"
        className={`h-9 rounded-md border px-3 text-sm ${t.input}`}
        maxLength={120}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What this step is. The member sees this."
        className={`min-h-16 resize-none rounded-md border px-3 py-2 text-xs ${t.input}`}
        maxLength={500}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
          >
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
          >
            <option value="access">Access</option>
            <option value="tooling">Tooling</option>
            <option value="docs">Docs</option>
            <option value="context">Context</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
          >
            Sort order
          </span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Tiers
        </span>
        <div className="flex items-center gap-1.5">
          {(['admin', 'lead', 'member'] as AccessTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => toggleTier(tier)}
              className={`h-7 rounded-md border px-2.5 text-[11px] transition ${
                tiers.includes(tier) ? t.btnActive : t.btn
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Skill labels (comma separated, leave empty for "any")
        </span>
        <input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="React, Next.js, Supabase"
          className={`h-9 rounded-md border px-3 text-xs ${t.input}`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Admin invite URL (where the admin invites this person)
        </span>
        <input
          type="url"
          value={adminUrl}
          onChange={(e) => setAdminUrl(e.target.value)}
          placeholder="https://github.com/orgs/.../people"
          className={`h-9 rounded-md border px-3 text-xs ${t.input}`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Member help URL (optional, what the member opens)
        </span>
        <input
          type="url"
          value={helpUrl}
          onChange={(e) => setHelpUrl(e.target.value)}
          placeholder="https://docs.example.com/..."
          className={`h-9 rounded-md border px-3 text-xs ${t.input}`}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy || submitting}
          className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={busy || submitting}
          className={`h-8 rounded-md px-3 text-xs disabled:opacity-50 ${t.accent}`}
        >
          {busy ? 'Saving...' : initial ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  )
}
