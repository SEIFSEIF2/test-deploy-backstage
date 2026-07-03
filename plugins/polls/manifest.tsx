import dynamic from 'next/dynamic'
import { Vote } from 'lucide-react'
import type { PluginManifest } from '@/lib/plugins/types'

const polls: PluginManifest = {
  id: 'polls',
  name: 'Team Polls',
  description: 'Quick team polls with live results.',
  longDescription:
    'Create a poll, let the team vote, watch results live. Leads and admins ' +
    'create polls; everyone votes. One vote per member, changeable until ' +
    'the poll is closed. New polls notify the team by push.',
  version: '0.1.0',
  author: 'Backstage',
  group: 'Team',
  icon: Vote,
  nav: { label: 'Polls', hint: 'Quick team decisions with live results.' },
  // Plain dynamic() only — `ssr: false` is rejected because manifests are
  // also imported by server code (the /dashboard/p/[pluginId] route).
  Panel: dynamic(() => import('./Panel')),
  palette: [{ label: 'New poll' }],
  presets: ['team', 'full']
}

export default polls
