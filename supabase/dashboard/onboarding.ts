import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember, requireAccessTier } from '@/lib/dal'
import { logActivity } from './mutations'
import type { Database } from '@/supabase/types'

type AccessTier = Database['public']['Enums']['access_tier']

const STATUS_VALUES = ['done', 'removed', 'na', 'blocked'] as const
type StepStatus = (typeof STATUS_VALUES)[number]

export interface OnboardingTemplateView {
  id: string
  title: string
  description: string | null
  category: string
  targetTiers: AccessTier[]
  targetSkills: string[] | null
  toolKey: string | null
  adminInviteUrl: string | null
  memberHelpUrl: string | null
  isRequired: boolean
  sortOrder: number
  archivedAt: string | null
}

export interface OnboardingChecklistRow extends OnboardingTemplateView {
  status: StepStatus | 'pending'
  completedAt: string | null
  completedBy: { id: string; fullName: string } | null
  note: string | null
}

export interface OnboardingMemberProgress {
  memberId: string
  fullName: string
  accessTier: AccessTier
  total: number
  done: number
  pending: number
  blocked: number
  percent: number
}

function memberSkillLabels(skills: unknown): string[] {
  if (!Array.isArray(skills)) return []
  const out: string[] = []
  for (const s of skills) {
    if (s && typeof s === 'object' && 'label' in s) {
      const label = (s as { label?: unknown }).label
      if (typeof label === 'string' && label) out.push(label)
    }
  }
  return out
}

function matchesMember(
  template: {
    target_tiers: AccessTier[]
    target_skills: string[] | null
  },
  memberTier: AccessTier,
  memberSkills: string[]
): boolean {
  if (!template.target_tiers.includes(memberTier)) return false
  if (!template.target_skills || template.target_skills.length === 0)
    return true
  return template.target_skills.some((s) => memberSkills.includes(s))
}

export async function listOnboardingProgress(): Promise<
  { error: string } | { members: OnboardingMemberProgress[] }
> {
  const member = await requireAccessTier(['admin', 'lead'])
  if (!member) return { error: 'Admin or lead only.' }
  const supabase = createAdminClient()

  const [{ data: members }, { data: templates }, { data: completions }] =
    await Promise.all([
      supabase
        .from('team_members')
        .select('id, full_name, access_tier, skills')
        .eq('company_id', member.companyId)
        .order('full_name', { ascending: true }),
      supabase
        .from('onboarding_step_templates')
        .select('id, target_tiers, target_skills, is_required')
        .eq('company_id', member.companyId)
        .is('archived_at', null),
      supabase
        .from('onboarding_step_completions')
        .select('member_id, template_id, status')
        .eq('company_id', member.companyId)
    ])

  const completionsByMember = new Map<string, Map<string, StepStatus>>()
  for (const c of completions ?? []) {
    let m = completionsByMember.get(c.member_id)
    if (!m) {
      m = new Map()
      completionsByMember.set(c.member_id, m)
    }
    m.set(c.template_id, c.status as StepStatus)
  }

  const rows: OnboardingMemberProgress[] = (members ?? []).map((m) => {
    const skills = memberSkillLabels(m.skills)
    const tier = m.access_tier as AccessTier
    const matching = (templates ?? []).filter((t) =>
      matchesMember(t, tier, skills)
    )
    const completionsFor = completionsByMember.get(m.id) ?? new Map()
    let done = 0
    let blocked = 0
    for (const t of matching) {
      const status = completionsFor.get(t.id)
      if (status === 'done' || status === 'removed' || status === 'na') done++
      else if (status === 'blocked') blocked++
    }
    const total = matching.length
    const pending = total - done - blocked
    return {
      memberId: m.id,
      fullName: m.full_name,
      accessTier: tier,
      total,
      done,
      pending,
      blocked,
      percent: total === 0 ? 0 : Math.round((done / total) * 100)
    }
  })

  return { members: rows }
}

export async function listMemberChecklist(memberId: string): Promise<
  | { error: string }
  | {
      member: {
        id: string
        fullName: string
        accessTier: AccessTier
        skills: string[]
      }
      checklist: OnboardingChecklistRow[]
      viewerCanEdit: boolean
    }
> {
  const idCheck = z.string().uuid().safeParse(memberId)
  if (!idCheck.success) return { error: 'Invalid member id.' }
  const viewer = await getCurrentTeamMember()
  if (!viewer) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: target } = await supabase
    .from('team_members')
    .select('id, full_name, access_tier, skills, company_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!target || target.company_id !== viewer.companyId) {
    return { error: 'Member not found.' }
  }

  // Self-view or admin/lead view. Members can see their own checklist,
  // they just can't tick anything (gate enforced server-side on writes).
  const viewerCanEdit =
    viewer.accessTier === 'admin' || viewer.accessTier === 'lead'
  if (!viewerCanEdit && viewer.id !== memberId) {
    return { error: 'You can only view your own checklist.' }
  }

  const [{ data: templates }, { data: completions }] = await Promise.all([
    supabase
      .from('onboarding_step_templates')
      .select('*')
      .eq('company_id', viewer.companyId)
      .is('archived_at', null)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true }),
    supabase
      .from('onboarding_step_completions')
      .select(
        'template_id, status, completed_at, note, completer:team_members!onboarding_step_completions_completed_by_fkey(id, full_name)'
      )
      .eq('company_id', viewer.companyId)
      .eq('member_id', memberId)
  ])

  const completionsByTemplate = new Map(
    (completions ?? []).map((c) => [c.template_id, c])
  )

  const skills = memberSkillLabels(target.skills)
  const tier = target.access_tier as AccessTier

  const checklist: OnboardingChecklistRow[] = (templates ?? [])
    .filter((t) => matchesMember(t, tier, skills))
    .map((t) => {
      const c = completionsByTemplate.get(t.id)
      const completer = c?.completer as
        | { id: string; full_name: string }
        | null
        | undefined
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        targetTiers: t.target_tiers,
        targetSkills: t.target_skills,
        toolKey: t.tool_key,
        adminInviteUrl: t.admin_invite_url,
        memberHelpUrl: t.member_help_url,
        isRequired: t.is_required,
        sortOrder: t.sort_order,
        archivedAt: t.archived_at,
        status: (c?.status as StepStatus | undefined) ?? 'pending',
        completedAt: c?.completed_at ?? null,
        completedBy: completer
          ? { id: completer.id, fullName: completer.full_name }
          : null,
        note: c?.note ?? null
      }
    })

  return {
    member: {
      id: target.id,
      fullName: target.full_name,
      accessTier: tier,
      skills
    },
    checklist,
    viewerCanEdit
  }
}

const MarkStepInput = z.object({
  memberId: z.string().uuid(),
  templateId: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
  note: z.string().max(500).optional().nullable()
})

export async function markStep(input: z.input<typeof MarkStepInput>) {
  const parsed = MarkStepInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const actor = await requireAccessTier(['admin', 'lead'])
  if (!actor) return { error: 'Only admin or lead can mark steps.' }
  const supabase = createAdminClient()

  const { data: template } = await supabase
    .from('onboarding_step_templates')
    .select('id, company_id, title')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!template || template.company_id !== actor.companyId) {
    return { error: 'Template not found.' }
  }

  const { data: member } = await supabase
    .from('team_members')
    .select('id, company_id, full_name')
    .eq('id', parsed.data.memberId)
    .maybeSingle()
  if (!member || member.company_id !== actor.companyId) {
    return { error: 'Member not found.' }
  }

  const { error } = await supabase.from('onboarding_step_completions').upsert(
    {
      company_id: actor.companyId,
      member_id: parsed.data.memberId,
      template_id: parsed.data.templateId,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      completed_by: actor.id,
      completed_at: new Date().toISOString()
    },
    { onConflict: 'member_id,template_id' }
  )
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    actor.companyId,
    actor.id,
    'onboarding.step_marked',
    'team_member',
    parsed.data.memberId,
    {
      template_id: parsed.data.templateId,
      template_title: template.title,
      status: parsed.data.status,
      member_name: member.full_name
    }
  )

  revalidatePath('/dashboard/onboarding')
  return { ok: true as const }
}

const CreateTemplateInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().min(1).max(40).default('tooling'),
  targetTiers: z.array(z.enum(['admin', 'lead', 'member'])).min(1),
  targetSkills: z.array(z.string().trim()).optional().nullable(),
  toolKey: z.string().trim().max(40).optional().nullable(),
  adminInviteUrl: z.string().trim().url().max(500).optional().nullable(),
  memberHelpUrl: z.string().trim().url().max(500).optional().nullable(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
})

export async function createTemplate(
  input: z.input<typeof CreateTemplateInput>
) {
  const parsed = CreateTemplateInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const actor = await requireAccessTier(['admin'])
  if (!actor) return { error: 'Admin only.' }
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('onboarding_step_templates')
    .insert({
      company_id: actor.companyId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      target_tiers: parsed.data.targetTiers,
      target_skills: parsed.data.targetSkills ?? null,
      tool_key: parsed.data.toolKey ?? null,
      admin_invite_url: parsed.data.adminInviteUrl ?? null,
      member_help_url: parsed.data.memberHelpUrl ?? null,
      is_required: parsed.data.isRequired,
      sort_order: parsed.data.sortOrder
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Create failed.' }

  revalidatePath('/dashboard/onboarding')
  return { ok: true as const, id: data.id }
}

const UpdateTemplateInput = CreateTemplateInput.partial().extend({
  templateId: z.string().uuid()
})

export async function updateTemplate(
  input: z.input<typeof UpdateTemplateInput>
) {
  const parsed = UpdateTemplateInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const actor = await requireAccessTier(['admin'])
  if (!actor) return { error: 'Admin only.' }
  const supabase = createAdminClient()

  const patch: Database['public']['Tables']['onboarding_step_templates']['Update'] =
    {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined)
    patch.description = parsed.data.description
  if (parsed.data.category !== undefined) patch.category = parsed.data.category
  if (parsed.data.targetTiers !== undefined)
    patch.target_tiers = parsed.data.targetTiers
  if (parsed.data.targetSkills !== undefined)
    patch.target_skills = parsed.data.targetSkills
  if (parsed.data.toolKey !== undefined) patch.tool_key = parsed.data.toolKey
  if (parsed.data.adminInviteUrl !== undefined)
    patch.admin_invite_url = parsed.data.adminInviteUrl
  if (parsed.data.memberHelpUrl !== undefined)
    patch.member_help_url = parsed.data.memberHelpUrl
  if (parsed.data.isRequired !== undefined)
    patch.is_required = parsed.data.isRequired
  if (parsed.data.sortOrder !== undefined)
    patch.sort_order = parsed.data.sortOrder

  const { error } = await supabase
    .from('onboarding_step_templates')
    .update(patch)
    .eq('id', parsed.data.templateId)
    .eq('company_id', actor.companyId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/onboarding')
  return { ok: true as const }
}

export async function archiveTemplate(templateId: string) {
  const idCheck = z.string().uuid().safeParse(templateId)
  if (!idCheck.success) return { error: 'Invalid template id.' }
  const actor = await requireAccessTier(['admin'])
  if (!actor) return { error: 'Admin only.' }
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('onboarding_step_templates')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', idCheck.data)
    .eq('company_id', actor.companyId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/onboarding')
  return { ok: true as const }
}

interface DefaultTemplate {
  title: string
  description: string
  category: 'access' | 'tooling' | 'docs' | 'context'
  target_tiers: AccessTier[]
  target_skills: string[] | null
  tool_key: string | null
  admin_invite_url: string | null
  member_help_url: string | null
  sort_order: number
}

const DEV_SKILLS = [
  'React',
  'Next.js',
  'Node.js',
  'TypeScript',
  'Postgres',
  'SQL',
  'Supabase'
]
const BACKEND_SKILLS = ['Node.js', 'Postgres', 'SQL', 'Supabase']
const DESIGN_SKILLS = ['Figma', 'UI design', 'UX research']

const DEFAULTS: DefaultTemplate[] = [
  {
    title: 'GitHub org invite',
    description: 'Invite to the GitHub org and the repos they will work in.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DEV_SKILLS,
    tool_key: 'github',
    admin_invite_url: 'https://github.com/settings/organizations',
    member_help_url: null,
    sort_order: 10
  },
  {
    title: 'Vercel team invite',
    description: 'Add to the Vercel team so they can see deploys.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DEV_SKILLS,
    tool_key: 'vercel',
    admin_invite_url: 'https://vercel.com/dashboard',
    member_help_url: null,
    sort_order: 20
  },
  {
    title: 'Supabase project access',
    description: 'Invite to the Supabase org so they can run queries.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: BACKEND_SKILLS,
    tool_key: 'supabase',
    admin_invite_url: 'https://supabase.com/dashboard/org/_/team',
    member_help_url: null,
    sort_order: 30
  },
  {
    title: 'Google Cloud IAM',
    description: 'Add IAM role on the GCP project (least-privilege).',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: BACKEND_SKILLS,
    tool_key: 'gcloud',
    admin_invite_url: 'https://console.cloud.google.com/iam-admin/iam',
    member_help_url: null,
    sort_order: 40
  },
  {
    title: 'Stripe team member',
    description: 'Invite to Stripe with read-only role unless they need more.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: BACKEND_SKILLS,
    tool_key: 'stripe',
    admin_invite_url: 'https://dashboard.stripe.com/settings/team',
    member_help_url: null,
    sort_order: 50
  },
  {
    title: 'Bunny storage access',
    description: 'Add to Bunny dashboard so they can manage content uploads.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: BACKEND_SKILLS,
    tool_key: 'bunny',
    admin_invite_url: 'https://dash.bunny.net/account/team',
    member_help_url: null,
    sort_order: 60
  },
  {
    title: 'Sentry org member',
    description: 'Add to the Sentry org so they get error notifications.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DEV_SKILLS,
    tool_key: 'sentry',
    admin_invite_url: 'https://sentry.io/settings/',
    member_help_url: null,
    sort_order: 70
  },
  {
    title: 'Resend access',
    description: 'Invite to Resend to send / debug transactional email.',
    category: 'access',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: BACKEND_SKILLS,
    tool_key: 'resend',
    admin_invite_url: 'https://resend.com/settings/team',
    member_help_url: null,
    sort_order: 80
  },
  {
    title: 'Brevo access',
    description:
      'Marketing sender. Add only if they own a marketing workstream.',
    category: 'access',
    target_tiers: ['admin', 'lead'],
    target_skills: null,
    tool_key: 'brevo',
    admin_invite_url: 'https://app.brevo.com/contact/team',
    member_help_url: null,
    sort_order: 90
  },
  {
    title: 'Figma file access',
    description: 'Share the team Figma file (Editor or Viewer role).',
    category: 'tooling',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DESIGN_SKILLS,
    tool_key: 'figma',
    admin_invite_url: 'https://www.figma.com/files/',
    member_help_url: null,
    sort_order: 100
  },
  {
    title: 'Brand guidelines + accent palette',
    description:
      'Read the brand page in settings before producing any visual asset.',
    category: 'docs',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: null,
    tool_key: null,
    admin_invite_url: null,
    member_help_url: '/settings/brand',
    sort_order: 110
  },
  {
    title: 'Team Google Drive',
    description:
      'Browse the shared Drive and the main working doc for context.',
    category: 'docs',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: null,
    tool_key: 'gdrive',
    admin_invite_url: null,
    member_help_url: 'https://drive.google.com/drive/',
    sort_order: 120
  },
  {
    title: 'Read CLAUDE.md / AGENTS.md',
    description:
      'The two project files that define how AI assistants (and humans) work in this codebase.',
    category: 'context',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DEV_SKILLS,
    tool_key: null,
    admin_invite_url: null,
    member_help_url: null,
    sort_order: 130
  },
  {
    title: 'Skim the latest ADRs',
    description:
      'docs/decisions/ has every architectural decision. Read the last 5 to catch up on context.',
    category: 'context',
    target_tiers: ['admin', 'lead', 'member'],
    target_skills: DEV_SKILLS,
    tool_key: null,
    admin_invite_url: null,
    member_help_url: null,
    sort_order: 140
  }
]

export async function seedDefaultTemplates(): Promise<
  { ok: true; count: number } | { error: string } | { skipped: true }
> {
  const actor = await requireAccessTier(['admin'])
  if (!actor) return { error: 'Admin only.' }
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('onboarding_step_templates')
    .select('id')
    .eq('company_id', actor.companyId)
    .limit(1)
  if (existing && existing.length > 0) {
    return { skipped: true }
  }

  const rows = DEFAULTS.map((d) => ({
    company_id: actor.companyId,
    title: d.title,
    description: d.description,
    category: d.category,
    target_tiers: d.target_tiers,
    target_skills: d.target_skills,
    tool_key: d.tool_key,
    admin_invite_url: d.admin_invite_url,
    member_help_url: d.member_help_url,
    is_required: true,
    sort_order: d.sort_order
  }))
  const { error } = await supabase
    .from('onboarding_step_templates')
    .insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/onboarding')
  return { ok: true, count: rows.length }
}

export async function listAllTemplates(): Promise<
  { error: string } | { templates: OnboardingTemplateView[] }
> {
  const actor = await requireAccessTier(['admin'])
  if (!actor) return { error: 'Admin only.' }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('onboarding_step_templates')
    .select('*')
    .eq('company_id', actor.companyId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  return {
    templates: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      targetTiers: t.target_tiers,
      targetSkills: t.target_skills,
      toolKey: t.tool_key,
      adminInviteUrl: t.admin_invite_url,
      memberHelpUrl: t.member_help_url,
      isRequired: t.is_required,
      sortOrder: t.sort_order,
      archivedAt: t.archived_at
    }))
  }
}
