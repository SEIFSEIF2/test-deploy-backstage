'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'

import { compressImage } from '@/lib/imageCompress'
import { uploadTaskImage as uploadTaskImageAction } from '../actions'
import { useDashTheme } from './theme'

export interface TaskAttachmentView {
  id: string
  taskId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  createdAt: string
  uploadedBy: { id: string; fullName: string } | null
  // Signed URL valid for ~1h. Re-issued on every fetchInitial round.
  url: string | null
}

interface Props {
  taskId: string
  currentUserId: string
  // Insert a temp attachment (with a local object URL) for optimistic
  // display in the gallery, then swap to the server-issued row when the
  // upload completes. Remove on error.
  onAttachmentAdded: (a: TaskAttachmentView) => void
  onAttachmentRemoved: (attachmentId: string) => void
  onAttachmentSwap: (tempId: string, real: TaskAttachmentView) => void
}

const IMG_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export default function TaskImageDropZone({
  taskId,
  currentUserId,
  onAttachmentAdded,
  onAttachmentRemoved,
  onAttachmentSwap
}: Props) {
  const { t } = useDashTheme()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => IMG_MIMES.includes(f.type))
      if (images.length === 0) {
        if (files.length > 0) {
          toast.error('Only PNG, JPEG, WebP, or GIF images are accepted.')
        }
        return
      }
      for (const file of images) {
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const objectUrl = URL.createObjectURL(file)
        onAttachmentAdded({
          id: localId,
          taskId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          width: null,
          height: null,
          createdAt: new Date().toISOString(),
          uploadedBy: { id: currentUserId, fullName: '' },
          url: objectUrl
        })
        try {
          const compressed = await compressImage(file)
          const form = new FormData()
          form.set('taskId', taskId)
          form.set(
            'file',
            new File([compressed.blob], compressed.fileName, {
              type: compressed.mimeType
            })
          )
          if (compressed.width) form.set('width', String(compressed.width))
          if (compressed.height) form.set('height', String(compressed.height))
          const res = await uploadTaskImageAction(form)
          if ('error' in res) {
            toast.error(res.error)
            onAttachmentRemoved(localId)
            URL.revokeObjectURL(objectUrl)
            continue
          }
          onAttachmentSwap(localId, res.attachment)
          URL.revokeObjectURL(objectUrl)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed.'
          toast.error(msg)
          onAttachmentRemoved(localId)
          URL.revokeObjectURL(objectUrl)
        }
      }
    },
    [
      taskId,
      currentUserId,
      onAttachmentAdded,
      onAttachmentRemoved,
      onAttachmentSwap
    ]
  )

  // Clipboard paste anywhere in the document while this component is
  // mounted. Skipped when the paste target is an input/textarea/contenteditable
  // so text paste into the description, comment box, etc. stays intact.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length === 0) return
      e.preventDefault()
      handleFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [handleFiles])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] tracking-[0.22em] uppercase ${t.textSubtle}`}
        >
          Images
        </span>
        <label
          htmlFor={inputId}
          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
        >
          <ImagePlus className="size-3.5" />
          Add
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={IMG_MIMES.join(',')}
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) handleFiles(files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
