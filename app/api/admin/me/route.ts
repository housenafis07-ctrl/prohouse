import { NextResponse } from 'next/server'
import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const current = await getCurrentAdmin()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: links } = current.role.role === 'super_admin' ? { data: [] } : await serviceClient().from('admin_role_permissions').select('admin_permissions!inner(code)').eq('role_id', current.role.id)\n  const permissionCodes = (links ?? []).map((row: any) => row.admin_permissions?.code).filter(Boolean)\n  return NextResponse.json({ user: { id: current.user.id, email: current.user.email }, role: current.role.role, permissions: permissionCodes })
}
