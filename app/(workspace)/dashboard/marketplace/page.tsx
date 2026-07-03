import type { Metadata } from 'next'
import { dashboardMetadata } from '../_components/fetchInitial'

type SearchParams = Promise<{ project?: string }>

export async function generateMetadata({
  searchParams
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const { project } = await searchParams
  return dashboardMetadata(project)
}

// Always available (no requireFeature): the marketplace is where features
// get turned on in the first place. URL target only — the chrome in the
// layout mounts <MarketplacePanel/>.
export default function MarketplacePage() {
  return null
}
