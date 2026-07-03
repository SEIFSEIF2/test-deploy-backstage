import type { Metadata } from 'next'
import { DemoBoard } from './_components/DemoBoard'
import { config } from '@/lib/config'

export const metadata: Metadata = {
  title: `Demo · ${config.appName}`,
  description: `Live demo of the ${config.appName} board. No login, no Supabase, changes reset on refresh.`
}

export default function DashboardDemoPage() {
  return <DemoBoard />
}
