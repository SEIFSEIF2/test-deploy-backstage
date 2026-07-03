import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { hasAnyCompany } from '@/lib/branding'
import { config } from '@/lib/config'
import { SetupForm } from './setup-form'

export const metadata: Metadata = {
  title: `Setup · ${config.appName}`
}

export default async function SetupPage() {
  if (await hasAnyCompany()) {
    redirect('/login')
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <div className="relative z-10 w-full max-w-sm">
        <SetupForm />
      </div>
    </div>
  )
}
