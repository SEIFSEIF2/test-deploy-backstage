export const FEATURES = {
  meetings: {
    label: 'Meetings',
    description: '1:1 request flow with approval, shared meet link, expiry.',
    group: 'Team'
  },
  onboarding: {
    label: 'Onboarding tracker',
    description: 'Per-member setup checklists with template editor.',
    group: 'Team'
  },
  portfolio: {
    label: 'Portfolio pages',
    description: 'Public /:handle member profile pages.',
    group: 'Team'
  },
  sprints: {
    label: 'Sprints',
    description: 'Auto-cycling weekly sprints on the board.',
    group: 'Work'
  },
  updatesPanel: {
    label: 'Updates panel',
    description: 'Right-side activity and notifications feed.',
    group: 'Work'
  },
  retros: {
    label: 'Retrospectives',
    description: 'End-of-sprint retro flow.',
    group: 'Work'
  },
  reactions: {
    label: 'Reactions',
    description: 'Emoji reactions on tasks and comments.',
    group: 'Polish'
  },
  imageGallery: {
    label: 'Image gallery',
    description: 'Multi-image previews on tasks.',
    group: 'Polish'
  },
  aiPasteExport: {
    label: 'AI paste export',
    description: 'Copy structured briefs of selected tasks for pasting into an AI.',
    group: 'Polish'
  },
  welcomeBar: {
    label: 'Welcome bar',
    description: 'Animated greeting bar at the top of the dashboard.',
    group: 'Polish'
  },
  aiReview: {
    label: 'AI review',
    description: 'AI-assisted review helper.',
    group: 'Advanced'
  },
  multiWorkspace: {
    label: 'Multi-workspace accounts',
    description:
      'Inviting an email that already has an account attaches this workspace to it instead of creating a second login.',
    group: 'Advanced'
  }
} as const

export type FeatureKey = keyof typeof FEATURES

// Core keys plus namespaced plugin keys (`plugin:<id>`). Everything that
// reads/writes companies.enabled_features speaks this wider type; core
// call sites keep passing literals unchanged.
export type AnyFeatureKey = FeatureKey | `plugin:${string}`

export const ALL_FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export const PRESETS: Record<'solo' | 'team' | 'full', FeatureKey[]> = {
  solo: ['sprints', 'reactions', 'welcomeBar'],
  team: [
    'sprints',
    'reactions',
    'imageGallery',
    'welcomeBar',
    'updatesPanel',
    'onboarding'
  ],
  full: ALL_FEATURE_KEYS.filter(
    (k) => k !== 'aiReview' && k !== 'multiWorkspace'
  )
}
