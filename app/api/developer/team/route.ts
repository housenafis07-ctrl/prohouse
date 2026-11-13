import { NextResponse } from 'next/server'
import { canManageTeam, getDeveloperCrmContext } from '@/lib/developer/crm-access'

export async function GET() {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const { data: members, error } = await ctx.db.from('developer_team_members')
    .select('id,user_id,role,status,invited_at,joined_at,created_at')
    .eq('developer_id', ctx.developer.id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'TEAM_LOAD_FAILED' }, { status: 500 })
  const ids = (members || []).map(item => item.user_id)
  const { data: profiles, error: profileError } = ids.length
    ? await ctx.db.from('profiles').select('id,phone,full_name').in('id', ids)
    : { data: [], error: null }
  if (profileError) return NextResponse.json({ error: 'TEAM_PROFILES_LOAD_FAILED' }, { status: 500 })
  const profileById = new Map((profiles || []).map(item => [item.id, item]))
  return NextResponse.json({
    role: ctx.role,
    members: (members || []).map(item => ({ ...item, profile: profileById.get(item.user_id) || null })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  if (!canManageTeam(ctx.role)) return NextResponse.json({ error: 'TEAM_MANAGEMENT_FORBIDDEN' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const phone = typeof body?.phone === 'string' ? body.phone.replace(/[^+\d]/g, '') : ''
  const role = typeof body?.role === 'string' ? body.role : 'sales_agent'
  const allowed = ['admin', 'sales_manager', 'sales_agent', 'marketing', 'analyst']
  if (phone.length < 7 || phone.length > 20 || !allowed.includes(role)) {
    return NextResponse.json({ error: 'INVALID_TEAM_MEMBER' }, { status: 400 })
  }
  const { data: profile, error: profileError } = await ctx.db.from('profiles')
    .select('id').eq('phone', phone).maybeSingle()
  if (profileError) return NextResponse.json({ error: 'TEAM_USER_LOOKUP_FAILED' }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'USER_NOT_REGISTERED' }, { status: 404 })
  if (profile.id === ctx.userId) return NextResponse.json({ error: 'CANNOT_INVITE_SELF' }, { status: 400 })

  const { data, error } = await ctx.db.from('developer_team_members').upsert({
    developer_id: ctx.developer.id, user_id: profile.id, role, status: 'invited',
    invited_by: ctx.userId, invited_at: new Date().toISOString(), joined_at: null,
  }, { onConflict: 'developer_id,user_id' })
    .select('id,user_id,role,status,invited_at').single()
  if (error) return NextResponse.json({ error: 'TEAM_INVITE_FAILED' }, { status: 500 })
  return NextResponse.json({ member: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  if (!canManageTeam(ctx.role)) return NextResponse.json({ error: 'TEAM_MANAGEMENT_FORBIDDEN' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const userId = typeof body?.user_id === 'string' ? body.user_id : ''
  const role = typeof body?.role === 'string' ? body.role : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const allowedRoles = ['admin', 'sales_manager', 'sales_agent', 'marketing', 'analyst']
  if (!userId || (!allowedRoles.includes(role) && !['active','suspended'].includes(status))) {
    return NextResponse.json({ error: 'INVALID_TEAM_UPDATE' }, { status: 400 })
  }
  const update: Record<string, string> = {}
  if (allowedRoles.includes(role)) update.role = role
  if (status === 'active' || status === 'suspended') update.status = status
  if (status === 'active') update.joined_at = new Date().toISOString()
  const { data, error } = await ctx.db.from('developer_team_members').update(update)
    .eq('developer_id', ctx.developer.id).eq('user_id', userId)
    .select('id,user_id,role,status').maybeSingle()
  if (error) return NextResponse.json({ error: 'TEAM_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'TEAM_MEMBER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ member: data })
}
