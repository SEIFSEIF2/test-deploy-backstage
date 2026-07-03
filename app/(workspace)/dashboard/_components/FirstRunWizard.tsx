'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useDashTheme } from './theme'
import { setEnabledFeatures } from '../features-actions'
import { PRESETS, FEATURES, type FeatureKey } from '@/lib/features/keys'

type Preset = keyof typeof PRESETS

const OPTIONS: Array<{
  id: Preset
  label: string
  tagline: string
}> = [
  {
    id: 'solo',
    label: 'Solo',
    tagline: 'Just the board, sprints, and reactions. Add the rest later.'
  },
  {
    id: 'team',
    label: 'Small team',
    tagline: 'Everything a 2-10 team needs day to day.'
  },
  {
    id: 'full',
    label: 'Full',
    tagline: 'Every stable module on. Advanced tools stay off by default.'
  }
]

export function FirstRunWizard({ onDone }: { onDone: () => void }) {
  const { t } = useDashTheme()
  const router = useRouter()
  const [busy, setBusy] = useState<Preset | null>(null)
  const [, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(false)

  async function pick(preset: Preset) {
    setBusy(preset)
    const res = await setEnabledFeatures(PRESETS[preset] as FeatureKey[])
    if ('error' in res) {
      toast.error(res.error)
      setBusy(null)
      return
    }
    toast.success(`${OPTIONS.find((o) => o.id === preset)?.label} preset enabled.`)
    startTransition(() => {
      router.refresh()
      onDone()
    })
  }

  if (dismissed) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className={`relative w-full max-w-lg rounded-xl border p-6 shadow-2xl ${t.detail}`}
      >
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className={`absolute top-3 right-3 flex size-7 items-center justify-center rounded-md transition ${t.btn}`}
        >
          <X className="size-3.5" />
        </button>

        <h2 className={`text-lg font-medium ${t.text}`}>
          Pick a starting preset
        </h2>
        <p className={`mt-1 text-xs ${t.textMuted}`}>
          Turns modules on in bulk. You can flip individual features under
          Settings › Features anytime.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const keys = PRESETS[opt.id] as FeatureKey[]
            const isBusy = busy === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => pick(opt.id)}
                disabled={busy !== null}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition disabled:opacity-50 ${t.border} ${t.tab}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-sm font-medium ${t.text}`}>
                    {opt.label}
                  </span>
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    {isBusy ? 'Saving...' : `${keys.length} modules`}
                  </span>
                </div>
                <span className={`text-[11px] leading-relaxed ${t.textMuted}`}>
                  {opt.tagline}
                </span>
                <span className={`text-[10px] ${t.textSubtle}`}>
                  Includes {keys.map((k) => FEATURES[k].label).join(', ')}.
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className={`mt-4 text-[11px] ${t.textSubtle} hover:underline`}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
