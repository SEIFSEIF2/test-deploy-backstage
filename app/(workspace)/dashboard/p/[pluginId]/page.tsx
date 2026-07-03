import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dashboardMetadata } from '../../_components/fetchInitial'
import { requireFeature } from '@/lib/features/server'
import { PLUGIN_IDS } from '@/lib/plugins/registry'
import { pluginFeatureKey } from '@/lib/plugins/types'

type Params = Promise<{ pluginId: string }>
type SearchParams = Promise<{ project?: string }>

export async function generateMetadata({
  searchParams
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const { project } = await searchParams
  return dashboardMetadata(project)
}

// URL target only — the chrome in the layout reads usePathname() and
// mounts <PluginHost/> for this plugin id (same pattern as every panel).
export default async function PluginPage({ params }: { params: Params }) {
  const { pluginId } = await params
  if (!PLUGIN_IDS.includes(pluginId)) notFound()
  await requireFeature(pluginFeatureKey(pluginId))
  return null
}
