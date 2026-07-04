'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentTeamMember } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import { isFeatureEnabled } from '@/lib/features/server'
import { sendEmail } from '@/lib/email/send'
import { sendPushToMember } from '@/lib/push'
import { logActivity } from '@/supabase/dashboard/mutations'
import { PLUGIN_SERVERS } from '@/plugins.config.server'
import { pluginFeatureKey, type PluginContext } from '@/lib/plugins/types'

// The single server entry point for every plugin. Plugins never touch the
// actions barrel: their handlers are looked up here and called with a
// PluginContext. Payload is untrusted — handlers zod-parse it themselves.
export async function invokePluginAction(
  pluginId: string,
  action: string,
  payload: unknown
): Promise<{ ok: true; data: unknown } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const server = PLUGIN_SERVERS[pluginId]
  const handler = server?.actions[action]
  if (!handler) return { error: 'Unknown plugin action.' }

  if (!(await isFeatureEnabled(pluginFeatureKey(pluginId)))) {
    return { error: 'Plugin not enabled for this workspace.' }
  }

  const admin = createAdminClient()
  const ctx: PluginContext = {
    member,
    companyId: member.companyId,
    admin,
    logActivity: (actionName, entityType, entityId, metadata) =>
      logActivity(
        admin,
        member.companyId,
        member.id,
        actionName,
        entityType,
        entityId,
        metadata
      ),
    sendEmail,
    sendPushToMember,
    revalidateDashboard: () => revalidatePath('/dashboard', 'layout')
  }

  try {
    return { ok: true, data: await handler(ctx, payload) }
  } catch (err) {
    console.error(`[plugin:${pluginId}] ${action} failed`, err)
    return {
      error: err instanceof Error ? err.message : 'Plugin action failed.'
    }
  }
}
