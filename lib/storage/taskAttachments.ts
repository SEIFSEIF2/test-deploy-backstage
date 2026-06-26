import 'server-only'

import { createAdminClient } from '@/supabase/admin'

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments'
export const TASK_ATTACHMENTS_SIGNED_TTL_SECONDS = 60 * 60

export function buildAttachmentPath(
  companyId: string,
  taskId: string,
  fileUuid: string,
  ext: string
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  return `${companyId}/${taskId}/${fileUuid}.${safeExt}`
}

export async function uploadToBucket(
  path: string,
  blob: Blob,
  mimeType: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteFromBucket(
  path: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .remove([path])
  if (error) return { error: error.message }
  return { ok: true }
}

export async function signedUrlFor(
  path: string,
  ttlSeconds: number = TASK_ATTACHMENTS_SIGNED_TTL_SECONDS
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, ttlSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function signedUrlsFor(
  paths: string[],
  ttlSeconds: number = TASK_ATTACHMENTS_SIGNED_TTL_SECONDS
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const supabase = createAdminClient()
  const { data } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, ttlSeconds)
  const out = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl)
  }
  return out
}
