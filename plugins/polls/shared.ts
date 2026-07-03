import { z } from 'zod'

// Schemas shared by Panel (client) and server.ts. Keep this file free of
// server imports — it is bundled into the browser.

export const CreatePollInput = z.object({
  question: z.string().trim().min(1, 'Question is required.').max(200),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2, 'At least two options.')
    .max(8, 'At most eight options.')
})
export type CreatePollInput = z.infer<typeof CreatePollInput>

export const VoteInput = z.object({
  pollId: z.string().uuid(),
  optionIndex: z.number().int().min(0)
})
export type VoteInput = z.infer<typeof VoteInput>

export const ClosePollInput = z.object({
  pollId: z.string().uuid()
})
export type ClosePollInput = z.infer<typeof ClosePollInput>

export type PollView = {
  id: string
  question: string
  options: string[]
  createdBy: string
  creatorName: string
  createdAt: string
  closedAt: string | null
  // Vote count per option index, plus the caller's own choice.
  votes: number[]
  myVote: number | null
  totalVotes: number
}
