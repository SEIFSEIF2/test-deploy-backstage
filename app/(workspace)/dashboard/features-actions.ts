'use server'

import { revalidatePath } from 'next/cache'
import { requireAccessTier } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import {
  ALL_FEATURE_KEYS,
  type FeatureKey
} from '@/lib/features/keys'

function isValidKey(k: string): k is FeatureKey {
  return (ALL_FEATURE_KEYS as string[]).includes(k)
}

export async function setEnabledFeatures(
  keys: string[]
): Promise<{ ok: true } | { error: string }> {
  const actor = await requireAccessTier(['admin'])
  const clean = Array.from(new Set(keys.filter(isValidKey)))
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('companies')
    .update({ enabled_features: clean })
    .eq('id', actor.companyId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
