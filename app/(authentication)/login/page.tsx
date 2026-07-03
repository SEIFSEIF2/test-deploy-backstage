import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { LoginWordmark } from '@/components/login-wordmark'
import { getDefaultCompanyLogoUrl, hasAnyCompany } from '@/lib/branding'

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string; notice?: string }>
}) {
  if (!(await hasAnyCompany())) {
    redirect('/setup')
  }

  const { redirect: redirectTo, notice } = await searchParams
  const logoUrl = await getDefaultCompanyLogoUrl()

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <LoginWordmark />
      <div className="relative z-10 min-h-75 w-full max-w-sm">
        {notice === 'existing-account' && (
          <p className="mb-4 rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-center text-xs text-teal-700 dark:text-teal-300">
            That workspace was added to your existing account — sign in to
            continue.
          </p>
        )}
        <LoginForm redirectTo={redirectTo ?? ''} logoUrl={logoUrl} />
      </div>
    </div>
  )
}
