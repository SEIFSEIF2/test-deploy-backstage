import type { Metadata } from 'next'
import { dashboardMetadata } from '../_components/fetchInitial'
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

export default async function MeetingsPage() {
  await requireFeature('meetings')
  return null
}
