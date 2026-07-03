import 'server-only'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import type { FeatureKey } from './keys'

export type WorkspaceBranding = {
  enabledFeatures: FeatureKey[]
  logoUrl: string | null
}

export const getWorkspaceBranding = cache(
  async (): Promise<WorkspaceBranding> => {
    const member = await getCurrentTeamMember()
    if (!member) return { enabledFeatures: [], logoUrl: null }
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('companies')
      .select('enabled_features, logo_url')
      .eq('id', member.companyId)
      .maybeSingle()
    return {
      enabledFeatures: (data?.enabled_features as FeatureKey[] | null) ?? [],
      logoUrl: data?.logo_url ?? null
    }
  }
)

export async function getEnabledFeatures(): Promise<FeatureKey[]> {
  return (await getWorkspaceBranding()).enabledFeatures
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures()
  return enabled.includes(key)
}

export async function requireFeature(key: FeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) notFound()
}
