import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

export type AdminRole = 'super_admin' | 'admin'

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createSupabaseAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function getCurrentAdmin() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null
  const { data: role } = await serviceClient().from('admin_roles').select('id,user_id,role,is_active').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!role) return null
  return { user, role }
}

export async function requireAdmin(permission?: string) {
  const admin = await getCurrentAdmin()
  if (!admin) return { admin: null, error: 'Unauthorized' as const }
  if (admin.role.role === 'super_admin' || !permission) return { admin, error: null }
  const { data } = await serviceClient().from('admin_role_permissions').select('permission_id,admin_permissions!inner(code)').eq('role_id', admin.role.id)
  const allowed = (data ?? []).some((row: any) => row.admin_permissions?.code === permission)
  if (!allowed) return { admin: null, error: 'Forbidden' as const }
  return { admin, error: null }
}
