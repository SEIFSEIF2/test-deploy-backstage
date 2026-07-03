import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/supabase/admin'

// Login and other pre-auth surfaces sit outside the workspace shell,
// so they don't have a current user to derive company from. Backstage
// is single-tenant per install, so we grab the logo of the first
// (usually only) company row. Multi-tenant deployments fall back to
// the text wordmark.
export const getDefaultCompanyLogoUrl = cache(async (): Promise<
  string | null
> => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('companies')
    .select('logo_url')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.logo_url ?? null
})

// Fresh install detection: no company row means /setup hasn't run yet.
// Errors (e.g. migrations not applied) read as "no company" so the user
// lands on /setup, where the real error surfaces with context.
export const hasAnyCompany = cache(async (): Promise<boolean> => {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
  return (count ?? 0) > 0
})
