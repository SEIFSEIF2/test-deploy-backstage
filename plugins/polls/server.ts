import 'server-only'

import type { PluginContext, PluginServerModule } from '@/lib/plugins/types'
import {
  ClosePollInput,
  CreatePollInput,
  VoteInput,
  type PollView
} from './shared'

async function listPolls(ctx: PluginContext): Promise<PollView[]> {
  const { data: polls, error } = await ctx.admin
    .from('polls')
    .select('id, question, options, created_by, closed_at, created_at')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  if (!polls || polls.length === 0) return []

  const pollIds = polls.map((p) => p.id)
  const [{ data: votes }, { data: members }] = await Promise.all([
    ctx.admin
      .from('poll_votes')
      .select('poll_id, member_id, option_index')
      .in('poll_id', pollIds),
    ctx.admin
      .from('team_members')
      .select('id, full_name')
      .eq('company_id', ctx.companyId)
  ])
  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name]))

  return polls.map((p) => {
    const options = (p.options as string[]) ?? []
    const counts = new Array<number>(options.length).fill(0)
    let myVote: number | null = null
    let total = 0
    for (const v of votes ?? []) {
      if (v.poll_id !== p.id) continue
      if (v.option_index >= 0 && v.option_index < counts.length) {
        counts[v.option_index] += 1
        total += 1
      }
      if (v.member_id === ctx.member.id) myVote = v.option_index
    }
    return {
      id: p.id,
      question: p.question,
      options,
      createdBy: p.created_by,
      creatorName: nameById.get(p.created_by) ?? 'Former member',
      createdAt: p.created_at,
      closedAt: p.closed_at,
      votes: counts,
      myVote,
      totalVotes: total
    }
  })
}

async function createPoll(ctx: PluginContext, payload: unknown) {
  if (ctx.member.accessTier === 'member') {
    throw new Error('Only admins and leads can create polls.')
  }
  const input = CreatePollInput.parse(payload)

  const { data: poll, error } = await ctx.admin
    .from('polls')
    .insert({
      company_id: ctx.companyId,
      created_by: ctx.member.id,
      question: input.question,
      options: input.options
    })
    .select('id')
    .single()
  if (error || !poll)
    throw new Error(error?.message ?? 'Could not create poll.')

  await ctx.logActivity('poll_created', 'poll', poll.id, {
    question: input.question
  })

  // Fire-and-forget fan-out; a slow push provider must not block creation.
  void (async () => {
    const { data: members } = await ctx.admin
      .from('team_members')
      .select('id')
      .eq('company_id', ctx.companyId)
      .eq('activity_status', 'active')
      .neq('id', ctx.member.id)
    await Promise.allSettled(
      (members ?? []).map((m) =>
        ctx.sendPushToMember(m.id, {
          title: 'New poll',
          body: input.question,
          url: '/dashboard/p/polls',
          tag: `poll-${poll.id}`
        })
      )
    )
  })()

  return { id: poll.id }
}

async function vote(ctx: PluginContext, payload: unknown) {
  const input = VoteInput.parse(payload)

  const { data: poll, error } = await ctx.admin
    .from('polls')
    .select('id, options, closed_at')
    .eq('id', input.pollId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!poll) throw new Error('Poll not found.')
  if (poll.closed_at) throw new Error('Poll is closed.')
  const optionCount = ((poll.options as string[]) ?? []).length
  if (input.optionIndex >= optionCount) throw new Error('Invalid option.')

  const { error: upsertError } = await ctx.admin.from('poll_votes').upsert(
    {
      poll_id: poll.id,
      member_id: ctx.member.id,
      option_index: input.optionIndex
    },
    { onConflict: 'poll_id,member_id' }
  )
  if (upsertError) throw new Error(upsertError.message)
  return { ok: true }
}

async function closePoll(ctx: PluginContext, payload: unknown) {
  const input = ClosePollInput.parse(payload)

  const { data: poll, error } = await ctx.admin
    .from('polls')
    .select('id, created_by, closed_at')
    .eq('id', input.pollId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!poll) throw new Error('Poll not found.')
  if (poll.closed_at) return { ok: true }
  if (poll.created_by !== ctx.member.id && ctx.member.accessTier !== 'admin') {
    throw new Error('Only the poll creator or an admin can close a poll.')
  }

  const { error: updateError } = await ctx.admin
    .from('polls')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', poll.id)
    .eq('company_id', ctx.companyId)
  if (updateError) throw new Error(updateError.message)

  await ctx.logActivity('poll_closed', 'poll', poll.id)
  return { ok: true }
}

const pollsServer: PluginServerModule = {
  actions: { listPolls, createPoll, vote, closePoll }
}

export default pollsServer
