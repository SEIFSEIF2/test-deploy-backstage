import 'server-only'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import type { AnyFeatureKey } from './keys'

export type WorkspaceBranding = {
  enabledFeatures: AnyFeatureKey[]
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
      enabledFeatures: (data?.enabled_features as AnyFeatureKey[] | null) ?? [],
      logoUrl: data?.logo_url ?? null
    }
  }
)

export async function getEnabledFeatures(): Promise<AnyFeatureKey[]> {
  return (await getWorkspaceBranding()).enabledFeatures
}

export async function isFeatureEnabled(key: AnyFeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures()
  return enabled.includes(key)
}

export async function requireFeature(key: AnyFeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) notFound()
}
