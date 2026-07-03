import { PLUGINS } from '@/plugins.config'
import type { PluginManifest } from './types'

export function pluginById(id: string): PluginManifest | undefined {
  return PLUGINS.find((p) => p.id === id)
}

export const PLUGIN_IDS: readonly string[] = PLUGINS.map((p) => p.id)
