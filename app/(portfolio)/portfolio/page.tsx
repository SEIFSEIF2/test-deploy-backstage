import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { config } from '@/lib/config'

export const metadata: Metadata = {
  title: `Overview · ${config.appName}`,
  description: `The ${config.appName} portfolio overview is coming soon.`
}

// Placeholder for the eventual portfolio overview (list of members,
// projects, public stats). For now the "Back to overview" link from
// the workspace topbar lands here and explains that this surface is
// still under construction. Individual member profiles continue to
// work at /[slug].
export default function PortfolioComingSoonPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAFAF7] px-4 py-12 dark:bg-[#0E1414]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-[#948CC0]/12 blur-3xl dark:bg-[#948CC0]/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-500/10"
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-8 pt-16 sm:pt-24">
        <Link
          href="/"
          className="inline-flex items-center transition hover:opacity-80"
        >
          <span className="text-xl font-display tracking-tight text-zinc-900 dark:text-zinc-50">
            {config.appName}
          </span>
        </Link>

        <article className="flex w-full flex-col items-center gap-5 rounded-3xl border border-zinc-200/70 bg-white p-9 text-center shadow-[0_1px_0_rgba(15,18,23,0.04),0_18px_50px_-24px_rgba(15,18,23,0.18)] sm:p-12 dark:border-white/10 dark:bg-[#161F1F] dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#948CC0]/12 px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase text-[#6E62B0] dark:bg-[#948CC0]/15 dark:text-[#BCB3DD]">
            <Sparkles className="size-3" />
            Coming soon
          </span>

          <h1 className="font-display text-3xl leading-tight tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Overview is on the way
          </h1>

          <p className="max-w-md text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            We&apos;re still building this page. It&apos;ll surface the
            portfolio: members, projects, public stats, and the stuff
            worth showing off. For now the dashboard is the source of
            truth.
          </p>

          <Link
            href="/dashboard"
            className="group mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Backstage
          </Link>
        </article>

        <p className="text-[11px] tracking-[0.18em] uppercase text-zinc-400 dark:text-zinc-600">
          Individual profiles live at /your-handle.
        </p>
      </div>
    </main>
  )
}
