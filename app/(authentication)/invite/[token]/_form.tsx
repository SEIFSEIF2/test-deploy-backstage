'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from './actions'

export function InviteAcceptForm({
  token,
  existingAccount = false
}: {
  token: string
  existingAccount?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onAccept() {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvite({ token })
      if ('error' in res) {
        setError(res.error)
        return
      }
      // Attach invites join the workspace to an existing account: no
      // session was created, so send them to sign in as themselves.
      if (res.attached) {
        router.replace('/login?redirect=/dashboard&notice=existing-account')
        return
      }
      router.replace('/onboarding')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="h-9 rounded-md bg-teal-600 px-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        {pending
          ? existingAccount
            ? 'Adding workspace…'
            : 'Signing you in…'
          : 'Accept invite'}
      </button>
      <p className="text-[11px] text-zinc-500">
        {existingAccount
          ? 'This workspace will be added to your existing account.'
          : 'You will be asked to set a new password right after sign-in.'}
      </p>
    </div>
  )
}
