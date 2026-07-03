import type { Metadata } from 'next'
import { requireOnboardingComplete } from '@/lib/dal'
import { dashboardMetadata } from '../../_components/fetchInitial'
import { requireFeature } from '@/lib/features/server'

type SearchParams = Promise<{ project?: string }>

export async function generateMetadata({
  searchParams
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const { project } = await searchParams
  return dashboardMetadata(project)
}

// Like every other /dashboard/* page, this returns null — the chrome reads
// the pathname and mounts <BrandPanel/>. We still call
// requireOnboardingComplete so the auth + onboarding redirects happen
// before the panel paints (members typing the URL get the standard flow).
export default async function BrandPage() {
  await requireOnboardingComplete()
  await requireFeature('brandExporter')
  return null
}
