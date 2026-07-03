import type { Metadata } from 'next'
import { config } from '@/lib/config'

export const metadata: Metadata = {
  title: `Offline · ${config.appName}`
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-medium">You&apos;re offline</h1>
      <p className="max-w-md text-sm text-zinc-500">
        {config.appName} needs a network connection to load this page. Try again
        once you&apos;re back online.
      </p>
    </main>
  )
}
