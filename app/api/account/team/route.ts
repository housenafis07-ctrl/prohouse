import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

async function getPartnerUser() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  return user
}

async function getPlan(admin: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await admin.rpc('get_active_partner_plan', { p_user_id: userId })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function GET() {
  const user = await getPartnerUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const admin = serviceClient()
  try {
    const activePlan = await getPlan(admin, user.id)
    if (!activePlan?.company_profile) return NextResponse.json({ error: 'BUSINESS_PLAN_REQUIRED' }, { status: 403 })

    const { data: members, error } = await admin
      .from('partner_team_members')
      .select('id,member_user_id,role,created_at')
      .eq('partner_user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const usersById = new Map((usersPage?.users || []).map(member => [member.id, member]))
    const enriched = (members || []).map(member => {
      const authUser = usersById.get(member.member_user_id)
      return {
        ...member,
        email: authUser?.email || null,
        name: (authUser?.user_metadata?.full_name as string | undefined) || null,
      }
    })

    return NextResponse.json({ plan: activePlan, members: enriched })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TEAM_LOAD_FAILED' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getPartnerUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body?.role === 'manager' ? 'manager' : 'member'
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 })

  const admin = serviceClient()
  try {
    const activePlan = await getPlan(admin, user.id)
    if (!activePlan?.company_profile) return NextResponse.json({ error: 'BUSINESS_PLAN_REQUIRED' }, { status: 403 })

    const { data: existing, error: existingError } = await admin
      .from('partner_team_members')
      .select('id')
      .eq('partner_user_id', user.id)
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if ((existing?.length || 0) >= Number(activePlan.employee_limit || 0)) {
      return NextResponse.json({ error: 'EMPLOYEE_LIMIT_REACHED', limit: activePlan.employee_limit }, { status: 400 })
    }

    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
    const member = usersPage.users.find(candidate => candidate.email?.toLowerCase() === email)
    if (!member) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
    if (member.id === user.id) return NextResponse.json({ error: 'OWNER_CANNOT_BE_EMPLOYEE' }, { status: 400 })

    const { data, error } = await admin
      .from('partner_team_members')
      .insert({ partner_user_id: user.id, member_user_id: member.id, role })
      .select('id,member_user_id,role,created_at')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'ALREADY_ADDED' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      member: {
        ...data,
        email: member.email || null,
        name: (member.user_metadata?.full_name as string | undefined) || null,
      },
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TEAM_UPDATE_FAILED' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getPartnerUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 })

  const admin = serviceClient()
  const { error } = await admin
    .from('partner_team_members')
    .delete()
    .eq('id', id)
    .eq('partner_user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
