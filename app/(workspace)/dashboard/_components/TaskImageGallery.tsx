'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { deleteTaskAttachment as deleteTaskAttachmentAction } from '../actions'
import type { TaskAttachmentView } from './TaskImageDropZone'
import { useDashTheme } from './theme'

interface Props {
  attachments: TaskAttachmentView[]
  currentUserId: string
  isAdmin: boolean
  onAttachmentAdded: (a: TaskAttachmentView) => void
  onAttachmentRemoved: (attachmentId: string) => void
}

export default function TaskImageGallery({
  attachments,
  currentUserId,
  isAdmin,
  onAttachmentAdded,
  onAttachmentRemoved
}: Props) {
  const { t } = useDashTheme()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (attachments.length === 0) return null

  const [hero, ...rest] = attachments

  const handleDelete = async (a: TaskAttachmentView) => {
    onAttachmentRemoved(a.id)
    const res = await deleteTaskAttachmentAction(a.id)
    if ('error' in res) {
      toast.error(res.error)
      onAttachmentAdded(a)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpenIndex(0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpenIndex(0)
          }
        }}
        className={`group relative block w-full cursor-pointer overflow-hidden rounded-lg border ${t.borderSoft}`}
        title={hero.fileName}
      >
        {hero.url ? (
          <img
            src={hero.url}
            alt={hero.fileName}
            loading="lazy"
            className="block max-h-[220px] w-full bg-black/20 object-cover transition group-hover:scale-[1.01]"
          />
        ) : (
          <div
            className={`flex h-[140px] w-full items-center justify-center text-[11px] ${t.textMuted}`}
          >
            Loading...
          </div>
        )}
        {(isAdmin || hero.uploadedBy?.id === currentUserId) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(hero)
            }}
            aria-label={`Remove ${hero.fileName}`}
            className="absolute top-2 right-2 hidden size-7 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white transition group-hover:flex hover:bg-black/80"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {rest.map((a, i) => {
            const canDelete = isAdmin || a.uploadedBy?.id === currentUserId
            return (
              <div
                key={a.id}
                className={`group relative aspect-square max-h-20 overflow-hidden rounded-md border ${t.borderSoft}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(i + 1)}
                  className="block size-full"
                  title={a.fileName}
                >
                  {a.url ? (
                    <img
                      src={a.url}
                      alt={a.fileName}
                      loading="lazy"
                      className="size-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`flex size-full items-center justify-center ${t.textMuted} text-[10px]`}
                    >
                      Loading...
                    </div>
                  )}
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    aria-label={`Remove ${a.fileName}`}
                    className="absolute top-1 right-1 hidden size-6 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white transition group-hover:flex hover:bg-black/80"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {openIndex !== null && (
        <Lightbox
          attachments={attachments}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function Lightbox({
  attachments,
  startIndex,
  onClose
}: {
  attachments: TaskAttachmentView[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const total = attachments.length
  const goPrev = useCallback(
    () => setIndex((i) => (i - 1 + total) % total),
    [total]
  )
  const goNext = useCallback(() => setIndex((i) => (i + 1) % total), [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  const current = attachments[index]

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition hover:bg-black/70"
      >
        <X className="size-4" />
      </button>

      <span className="absolute top-4 left-4 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-xs text-white/80 tabular-nums">
        {index + 1} / {total}
      </span>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            aria-label="Previous image"
            className="absolute left-4 flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition hover:bg-black/70"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            aria-label="Next image"
            className="absolute right-4 flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition hover:bg-black/70"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {current?.url ? (
        <img
          src={current.url}
          alt={current.fileName}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="text-sm text-white/70">Preview unavailable.</div>
      )}
    </div>
  )
}
