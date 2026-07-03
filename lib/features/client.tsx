'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { FeatureKey } from './keys'

const FeaturesContext = createContext<Set<FeatureKey>>(new Set())

export function FeaturesProvider({
  enabled,
  children
}: {
  enabled: readonly FeatureKey[]
  children: ReactNode
}) {
  return (
    <FeaturesContext.Provider value={new Set(enabled)}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeature(key: FeatureKey): boolean {
  return useContext(FeaturesContext).has(key)
}
