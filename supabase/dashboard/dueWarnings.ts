import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { absoluteUrl, resolveMemberEmail, sendEmail } from '@/lib/email/send'
import { sendPushToMember } from '@/lib/push'
import { taskDueSoonEmail } from '@/lib/email/templates'
import { config } from '@/lib/config'

interface RunResult {
  ran: boolean
  scanned: number
  warned: number
  skipped: number
  errors: number
}

function formatDuePretty(iso: string): string {
  // 'Mon, Jul 15' style, locale-stable enough for our usage.
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })
}

function todayInAppTzIso(): string {
  // en-CA emits YYYY-MM-DD; shift to config.timezone so we compare against
  // the operator's local calendar, not UTC.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

// Lazy daily check. On first dashboard load of the day for a given company
// (relative to the app timezone), advance the cursor and fan out the warning.
// All subsequent calls today see the up-to-date cursor and bail.
// Fire-and-forget from the caller's perspective.
export async function runDueWarningsIfDue(
  companyId: string
): Promise<RunResult> {
  const supabase = createAdminClient()

  // Atomic race winner. Postgres NOW() runs server-side; converting to
  // config.timezone gives "today" in the workspace's local calendar.
  const { data: claim, error: claimErr } = await supabase.rpc(
    'claim_due_warning_run',
    {
      p_company_id: companyId,
      p_timezone: config.timezone
    }
  )
  if (claimErr) {
    return { ran: false, scanned: 0, warned: 0, skipped: 0, errors: 1 }
  }
  if (!claim) {
    return { ran: false, scanned: 0, warned: 0, skipped: 0, errors: 0 }
  }

  // "Tomorrow in the app timezone" - the date math. claim returns it for symmetry.
  const tomorrowIso = claim as string

  // Pull live tasks due tomorrow (app-timezone date), still actionable, not deleted.
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select(
      'id, ref, title, due_date, project_id, assignee_id, lead_id, status'
    )
    .eq('company_id', companyId)
    .eq('due_date', tomorrowIso)
    .is('deleted_at', null)
    .not('status', 'in', '(done,canceled,duplicate)')
  if (tasksErr) {
    return { ran: true, scanned: 0, warned: 0, skipped: 0, errors: 1 }
  }

  let scanned = 0
  let warned = 0
  let skipped = 0
  let errors = 0
  const taskUrl = (ref: string) => absoluteUrl(`/dashboard/t/${ref}`)
  const duePretty = formatDuePretty(tomorrowIso)

  for (const task of tasks ?? []) {
    scanned++
    if (!task.due_date) continue

    // Idempotency: if we've already logged due_soon for this (task, due_date)
    // pair, skip. Handles re-runs and edge cases where the same date is hit
    // twice (date bumped away then back).
    const { data: prior } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('entity_type', 'task')
      .eq('entity_id', task.id)
      .eq('action', 'task.due_soon')
      .filter('metadata->>due_date', 'eq', task.due_date)
      .limit(1)
      .maybeSingle()
    if (prior) {
      skipped++
      continue
    }

    // Recipients: assignee + lead, deduped, both must be set + non-null.
    const recipientIds = new Set<string>()
    if (task.assignee_id) recipientIds.add(task.assignee_id)
    if (task.lead_id) recipientIds.add(task.lead_id)
    if (recipientIds.size === 0) {
      skipped++
      continue
    }

    // Activity log row. Single entry per task per due_date.
    const { error: logErr } = await supabase.from('activity_logs').insert({
      company_id: companyId,
      actor_id: null,
      action: 'task.due_soon',
      entity_type: 'task',
      entity_id: task.id,
      metadata: {
        project_id: task.project_id,
        due_date: task.due_date,
        task_ref: task.ref,
        task_title: task.title,
        assignee_id: task.assignee_id,
        lead_id: task.lead_id
      }
    })
    if (logErr) {
      errors++
      continue
    }

    for (const memberId of recipientIds) {
      const { data: member } = await supabase
        .from('team_members')
        .select('id, full_name')
        .eq('id', memberId)
        .maybeSingle()
      if (!member) continue

      const to = await resolveMemberEmail(memberId)
      if (to) {
        const role: 'assignee' | 'lead' =
          memberId === task.assignee_id ? 'assignee' : 'lead'
        const tmpl = taskDueSoonEmail({
          recipientName: member.full_name,
          role,
          taskRef: task.ref ?? '',
          taskTitle: task.title,
          dueDate: task.due_date,
          dueDatePretty: duePretty,
          taskUrl: taskUrl(task.ref ?? task.id)
        })
        await sendEmail({
          to,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          tag: 'task_due_soon'
        }).catch(() => {})
      }

      await sendPushToMember(memberId, {
        title: `${task.ref ?? ''} is due tomorrow`,
        body: task.title,
        url: `/dashboard/t/${task.ref ?? task.id}`,
        tag: `due-soon-${task.id}`
      }).catch(() => {})
    }

    warned++
  }

  // Auto-start any upcoming sprint whose from_date has arrived, scoped
  // to projects that don't already have a current sprint running. Runs
  // once per company per day because we're behind the same claim gate
  // as due-warning fan-out.
  try {
    const todayIso = todayInAppTzIso()
    const { data: dueSprints } = await supabase
      .from('sprints')
      .select('id, project_id, number, name, goal, started_at')
      .eq('company_id', companyId)
      .eq('status', 'upcoming')
      .lte('from_date', todayIso)
    for (const sprint of dueSprints ?? []) {
      const { data: hasCurrent } = await supabase
        .from('sprints')
        .select('id')
        .eq('project_id', sprint.project_id)
        .eq('status', 'current')
        .limit(1)
        .maybeSingle()
      if (hasCurrent) continue
      const { error: updErr, count } = await supabase
        .from('sprints')
        .update(
          {
            status: 'current',
            started_at: new Date().toISOString()
          },
          { count: 'exact' }
        )
        .eq('id', sprint.id)
        .eq('status', 'upcoming')
      if (updErr || !count) continue
      await supabase.from('activity_logs').insert({
        company_id: companyId,
        actor_id: null,
        action: 'sprint.started',
        entity_type: 'sprint',
        entity_id: sprint.id,
        metadata: {
          project_id: sprint.project_id,
          sprint_number: sprint.number,
          sprint_name: sprint.name,
          goal: sprint.goal,
          auto: true,
          started_by_name: 'system'
        }
      })
    }
  } catch (err) {
    console.error('[sprint-auto-start] failed', err)
  }

  return { ran: true, scanned, warned, skipped, errors }
}
