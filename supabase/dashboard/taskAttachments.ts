import 'server-only'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import {
  buildAttachmentPath,
  deleteFromBucket,
  signedUrlFor,
  signedUrlsFor,
  uploadToBucket
} from '@/lib/storage/taskAttachments'
import { logActivity } from './mutations'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])

const EXT_FOR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export interface TaskAttachment {
  id: string
  taskId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  createdAt: string
  uploadedBy: { id: string; fullName: string } | null
  url: string | null
}

export async function uploadTaskImage(
  form: FormData
): Promise<
  | { ok: true; attachment: TaskAttachment }
  | { error: string }
> {
  const taskId = String(form.get('taskId') ?? '')
  const file = form.get('file')
  const width = Number(form.get('width') ?? 0) || null
  const height = Number(form.get('height') ?? 0) || null
  if (!taskId) return { error: 'Missing taskId.' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No file received.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: 'Only PNG, JPEG, WebP, or GIF images are allowed.' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image is over 10 MB after compression.' }
  }

  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const supabase = createAdminClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, company_id')
    .eq('id', taskId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!task || task.company_id !== member.companyId) {
    return { error: 'Task not found.' }
  }

  const fileUuid = randomUUID()
  const ext = EXT_FOR_MIME[file.type] ?? 'bin'
  const path = buildAttachmentPath(member.companyId, taskId, fileUuid, ext)

  const uploaded = await uploadToBucket(path, file, file.type)
  if ('error' in uploaded) {
    return { error: `Upload failed: ${uploaded.error}` }
  }

  const { data: row, error: dbErr } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      company_id: member.companyId,
      uploaded_by: member.id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      width,
      height
    })
    .select('id, created_at')
    .single()
  if (dbErr || !row) {
    await deleteFromBucket(path).catch(() => undefined)
    return { error: dbErr?.message ?? 'Insert failed.' }
  }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.attachment_added',
    'task',
    taskId,
    { attachmentId: row.id, fileName: file.name, sizeBytes: file.size }
  )

  const url = await signedUrlFor(path)
  revalidatePath('/dashboard')

  return {
    ok: true,
    attachment: {
      id: row.id,
      taskId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      width,
      height,
      createdAt: row.created_at,
      uploadedBy: { id: member.id, fullName: member.fullName },
      url
    }
  }
}

export async function deleteTaskAttachment(
  attachmentId: string
): Promise<{ ok: true } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('task_attachments')
    .select('id, task_id, company_id, uploaded_by, storage_path')
    .eq('id', attachmentId)
    .maybeSingle()
  if (!row || row.company_id !== member.companyId) {
    return { error: 'Attachment not found.' }
  }

  const isAdmin = member.accessTier === 'admin'
  const isUploader = row.uploaded_by === member.id
  if (!isAdmin && !isUploader) {
    return { error: 'Only the uploader or an admin can remove this image.' }
  }

  await deleteFromBucket(row.storage_path).catch(() => undefined)

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.attachment_removed',
    'task',
    row.task_id,
    { attachmentId: row.id }
  )

  revalidatePath('/dashboard')
  return { ok: true }
}

export interface AttachmentRowWithMember {
  id: string
  task_id: string
  company_id: string
  uploaded_by: string | null
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  created_at: string
  uploader: { id: string; full_name: string } | null
}

export async function listTaskAttachmentsForTasks(
  taskIds: string[]
): Promise<TaskAttachment[]> {
  if (taskIds.length === 0) return []
  const member = await getCurrentTeamMember()
  if (!member) return []
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('task_attachments')
    .select(
      'id, task_id, company_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, width, height, created_at, uploader:team_members!task_attachments_uploaded_by_fkey(id, full_name)'
    )
    .eq('company_id', member.companyId)
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as unknown as AttachmentRowWithMember[]
  const urls = await signedUrlsFor(rows.map((r) => r.storage_path))

  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
    uploadedBy: r.uploader
      ? { id: r.uploader.id, fullName: r.uploader.full_name }
      : null,
    url: urls.get(r.storage_path) ?? null
  }))
}
