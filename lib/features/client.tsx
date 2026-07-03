'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AnyFeatureKey } from './keys'

export type WorkspaceOption = {
  id: string
  name: string
  logoUrl: string | null
}

type BrandingValue = {
  enabled: Set<AnyFeatureKey>
  logoUrl: string | null
  companyId: string | null
  companyName: string | null
  workspaces: WorkspaceOption[]
}

const BrandingContext = createContext<BrandingValue>({
  enabled: new Set(),
  logoUrl: null,
  companyId: null,
  companyName: null,
  workspaces: []
})

export function FeaturesProvider({
  enabled,
  logoUrl,
  companyId = null,
  companyName = null,
  workspaces = [],
  children
}: {
  enabled: readonly AnyFeatureKey[]
  logoUrl: string | null
  companyId?: string | null
  companyName?: string | null
  workspaces?: WorkspaceOption[]
  children: ReactNode
}) {
  return (
    <BrandingContext.Provider
      value={{
        enabled: new Set(enabled),
        logoUrl,
        companyId,
        companyName,
        workspaces
      }}
    >
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

export function useActiveWorkspace(): { id: string; name: string } | null {
  const { companyId, companyName } = useContext(BrandingContext)
  return companyId ? { id: companyId, name: companyName ?? '' } : null
}

export function useMyWorkspaces(): WorkspaceOption[] {
  return useContext(BrandingContext).workspaces
}
