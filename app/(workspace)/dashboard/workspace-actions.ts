'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'

// Sets the per-device active workspace for accounts with multiple
// memberships. The cookie is read in exactly one place (lib/dal.ts
// getCurrentTeamMember); it takes effect on the next request, so callers
// follow up with router.push('/dashboard') + router.refresh().
export async function switchWorkspace(
  companyId: string
): Promise<{ ok: true } | { error: string }> {
  const claims = await verifySession()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', claims.sub as string)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!data) return { error: 'Not a member of that workspace.' }

  const jar = await cookies()
  jar.set('bs-active-workspace', companyId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}
