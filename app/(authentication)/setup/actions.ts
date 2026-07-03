'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/supabase/admin'
import { slugify } from '@/lib/slug'

export type SetupState = { error: string } | undefined

// First-run bootstrap: creates the admin auth user, the company, and the
// owning team_members row in one shot. Guarded so it only ever works on an
// empty install; once a company exists this action is a no-op redirect.
export async function createWorkspace(
  _prev: SetupState,
  formData: FormData
): Promise<SetupState> {
  const workspaceName = String(formData.get('workspace') ?? '').trim()
  const fullName = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!workspaceName || !fullName || !email) {
    return { error: 'All fields are required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = createAdminClient()

  const { count, error: countError } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
  if (countError) {
    return {
      error: `Could not reach the database: ${countError.message}. Check that migrations ran during the build.`
    }
  }
  if ((count ?? 0) > 0) {
    redirect('/login')
  }

  const { data: created, error: userError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
  if (userError || !created?.user) {
    return { error: userError?.message ?? 'Could not create the admin account.' }
  }
  const userId = created.user.id

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({ name: workspaceName, slug: slugify(workspaceName) })
    .select('id')
    .single()
  if (companyError || !company) {
    await supabase.auth.admin.deleteUser(userId)
    return { error: companyError?.message ?? 'Could not create the workspace.' }
  }

  const { error: memberError } = await supabase.from('team_members').insert({
    id: userId,
    company_id: company.id,
    email,
    full_name: fullName,
    access_tier: 'admin',
    slug: slugify(fullName)
  })
  if (memberError) {
    await supabase.from('companies').delete().eq('id', company.id)
    await supabase.auth.admin.deleteUser(userId)
    return { error: memberError.message }
  }

  await supabase
    .from('companies')
    .update({ owner_id: userId })
    .eq('id', company.id)

  redirect('/login')
}
