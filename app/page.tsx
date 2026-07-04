import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight,
  BellRing,
  Calendar,
  CheckSquare,
  Code2 as Github,
  ImageIcon,
  Sparkles,
  UserPlus,
  Users,
  Zap
} from 'lucide-react'
import { config } from '@/lib/config'

const DEPLOY_URL =
  'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSEIFSEIF4%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_APP_NAME&envDescription=Your%20app%20name%20(e.g.%20Backstage).%20Everything%20else%20is%20configured%20post-deploy.'

export const metadata: Metadata = {
  title: `${config.appName} - ${config.appTagline}`,
  description: `${config.appName} is a self-hosted team ops platform: sprint board, one-on-ones, onboarding checklists, and the polish that makes day-to-day work feel less clunky.`
}

const FEATURES = [
  {
    icon: CheckSquare,
    title: 'Sprint board',
    body: 'Weekly cadence, chip-controlled sections, drag between statuses, auto-add to sprint.'
  },
  {
    icon: Calendar,
    title: '1:1 meetings',
    body: 'Request, approve, propose slots, shared meet link. Everything on one calendar.'
  },
  {
    icon: UserPlus,
    title: 'Onboarding tracker',
    body: 'Per-member checklists matched to tier and skills. Templates you edit as your stack changes.'
  },
  {
    icon: BellRing,
    title: 'Updates feed',
    body: 'Activity, deletions, meeting events, sprint events. One panel per person, unread badge.'
  },
  {
    icon: ImageIcon,
    title: 'Image gallery',
    body: 'Drop screenshots on tasks. Preview, delete, reorder.'
  },
  {
    icon: Sparkles,
    title: 'AI paste export',
    body: 'Copy a structured brief of selected tasks. Paste an AI response back to bulk-create.'
  }
]

export default function LandingPage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#FAFAF7] dark:bg-[#0E1414]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-[#948CC0]/15 blur-3xl dark:bg-[#948CC0]/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 pt-10 pb-24 sm:pt-14">
        <TopBar />
        <Hero />
        <FeatureGrid />
        <DeployBlock />
        <Footer />
      </div>
    </main>
  )
}

function TopBar() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md bg-[#948CC0]/15 text-xs font-bold text-[#6E62B0] dark:bg-[#948CC0]/20 dark:text-[#BCB3DD]"
        >
          {config.appName.slice(0, 1).toUpperCase()}
        </div>
        <span className="font-display text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
          {config.appName}
        </span>
      </div>
      <nav className="flex items-center gap-2">
        <a
          href="https://github.com/SEIFSEIF4/backstage"
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          GitHub
        </a>
        <Link
          href="/dashboard-demo"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Try demo
          <ArrowRight className="size-3.5" />
        </Link>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 pt-6 text-center sm:pt-10">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#948CC0]/12 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-[#6E62B0] uppercase dark:bg-[#948CC0]/15 dark:text-[#BCB3DD]">
        <Zap className="size-3" />
        Self-hosted team ops
      </span>
      <h1 className="font-display max-w-3xl text-4xl leading-tight tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
        {config.appTagline}
      </h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
        Sprint board, one-on-ones, onboarding checklists, retros. Modular
        features you flip on when you need them, off when you don&apos;t. Deploy
        your own copy in a click.
      </p>
      <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/dashboard-demo"
          className="group inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Try the live demo
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <a
          href={DEPLOY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition hover:bg-white dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/5"
        >
          Deploy your own
        </a>
      </div>
    </section>
  )
}

function FeatureGrid() {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <article
          key={f.title}
          className="flex flex-col gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_0_rgba(15,18,23,0.04)] backdrop-blur dark:border-white/10 dark:bg-[#161F1F]/80"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#948CC0]/12 text-[#6E62B0] dark:bg-[#948CC0]/15 dark:text-[#BCB3DD]">
            <f.icon className="size-4" />
          </div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {f.title}
          </h3>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            {f.body}
          </p>
        </article>
      ))}
    </section>
  )
}

function DeployBlock() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200/70 bg-white/70 p-8 text-center backdrop-blur sm:p-12 dark:border-white/10 dark:bg-[#161F1F]/70">
      <Users className="size-6 text-[#6E62B0] dark:text-[#BCB3DD]" />
      <h2 className="font-display text-2xl leading-tight tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Own the whole stack
      </h2>
      <p className="max-w-lg text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300">
        MIT-licensed. One click provisions the backend and deploys the app. Your
        data, your rules.
      </p>
      <a
        href={DEPLOY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Deploy your own
        <ArrowRight className="size-4" />
      </a>
    </section>
  )
}

function Footer() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-zinc-200/70 pt-8 text-[11px] tracking-[0.15em] text-zinc-400 uppercase dark:border-white/10 dark:text-zinc-600">
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/SEIFSEIF4/backstage"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 transition hover:text-zinc-600 dark:hover:text-zinc-400"
        >
          <Github className="size-3" />
          Source
        </a>
        <span className="size-1 rounded-full bg-zinc-300 dark:bg-white/10" />
        <Link
          href="/dashboard-demo"
          className="transition hover:text-zinc-600 dark:hover:text-zinc-400"
        >
          Demo
        </Link>
        <span className="size-1 rounded-full bg-zinc-300 dark:bg-white/10" />
        <span>MIT</span>
      </div>
    </footer>
  )
}
