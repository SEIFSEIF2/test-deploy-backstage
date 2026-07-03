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

const ALLOWED_LOGO_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
] as const
const MAX_LOGO_BYTES = 2 * 1024 * 1024

export async function uploadCompanyLogo(
  formData: FormData
): Promise<{ ok: true; url: string } | { error: string }> {
  const actor = await requireAccessTier(['admin'])
  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Pick an image first.' }
  }
  if (
    !ALLOWED_LOGO_TYPES.includes(
      file.type as (typeof ALLOWED_LOGO_TYPES)[number]
    )
  ) {
    return { error: 'Logo must be PNG, JPG, WEBP, or SVG.' }
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: 'Logo must be 2 MB or smaller.' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `company/${actor.companyId}/logo.${ext}`
  const admin = createAdminClient()
  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }

  const { data } = admin.storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`
  const { error: dbErr } = await admin
    .from('companies')
    .update({ logo_url: url })
    .eq('id', actor.companyId)
  if (dbErr) return { error: dbErr.message }
  revalidatePath('/dashboard', 'layout')
  return { ok: true, url }
}

export async function clearCompanyLogo(): Promise<
  { ok: true } | { error: string }
> {
  const actor = await requireAccessTier(['admin'])
  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({ logo_url: null })
    .eq('id', actor.companyId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
