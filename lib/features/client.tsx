'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AnyFeatureKey } from './keys'

type BrandingValue = {
  enabled: Set<AnyFeatureKey>
  logoUrl: string | null
}

const BrandingContext = createContext<BrandingValue>({
  enabled: new Set(),
  logoUrl: null
})

export function FeaturesProvider({
  enabled,
  logoUrl,
  children
}: {
  enabled: readonly AnyFeatureKey[]
  logoUrl: string | null
  children: ReactNode
}) {
  return (
    <BrandingContext.Provider value={{ enabled: new Set(enabled), logoUrl }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useFeature(key: AnyFeatureKey): boolean {
  return useContext(BrandingContext).enabled.has(key)
}

export function useEnabledFeatures(): Set<AnyFeatureKey> {
  return useContext(BrandingContext).enabled
}

export function useCompanyLogoUrl(): string | null {
  return useContext(BrandingContext).logoUrl
}
