import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import type { FeatureKey } from './keys'

export const getEnabledFeatures = cache(async (): Promise<FeatureKey[]> => {
  const member = await getCurrentTeamMember()
  if (!member) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('companies')
    .select('enabled_features')
    .eq('id', member.companyId)
    .maybeSingle()
  return (data?.enabled_features as FeatureKey[] | null) ?? []
})

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures()
  return enabled.includes(key)
}
