import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const allowedStatuses = ['new', 'contacted', 'qualified', 'viewing', 'reserved', 'won', 'lost']

async function getDeveloperContext() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }

  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles')
    .select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 }) }
  if (!account || account.account_type !== 'partner') {
    return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  }
  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }

  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('id,user_id,developer_name,description,verification_status')
    .eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.verification_status !== 'verified') return { error: NextResponse.json({ error: 'DEVELOPER_NOT_APPROVED' }, { status: 403 }) }
  if (developer.user_id && developer.user_id !== userId) {
    return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 }) }
  }
  if (!developer.user_id) {
    const { error } = await db.from('developer_profiles').update({ user_id: userId }).eq('id', developer.id)
    if (error) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LINK_FAILED' }, { status: 500 }) }
  }
  return { db, developer }
}

export async function GET() {
  const context = await getDeveloperCrmContext()
  if ('error' in context) return NextResponse.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 403 })
  if (!['owner','admin','sales_manager','sales_agent'].includes(context.role)) {
    return NextResponse.json({ error: 'LEADS_FORBIDDEN' }, { status: 403 })
  }
  let query = context.db.from('developer_lead_requests')
    .select('id,name,phone,message,status,created_at,complex_id,unit_id,assigned_to,priority,next_follow_up_at,lost_reason,last_contacted_at')
    .eq('developer_id', context.developer.id).order('created_at', { ascending: false })
  if (context.role === 'sales_agent') query = query.eq('assigned_to', context.userId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'DEVELOPER_LEADS_LOAD_FAILED' }, { status: 500 })
  const leads = data || []
  const complexIds = [...new Set(leads.map((lead: any) => lead.complex_id).filter((id: unknown): id is string => typeof id === 'string'))]
  let complexById = new Map<string, { name: string; slug: string; city: string; district: string | null; is_verified: boolean }>()
  if (complexIds.length) {
    const { data: complexes, error: complexesError } = await context.db.from('residential_complexes')
      .select('id,name,slug,city,district,is_verified').eq('developer_id', context.developer.id).in('id', complexIds)
    if (complexesError) return NextResponse.json({ error: 'LEAD_COMPLEX_DETAILS_LOAD_FAILED' }, { status: 500 })
    complexById = new Map((complexes || []).map((complex: any) => [complex.id, complex]))
  }
  const ownedComplexIds = [...complexById.keys()]
  const buildingById = new Map<string, { name: string; building_no: string | null }>()
  if (ownedComplexIds.length) {
    const { data: buildings, error: buildingsError } = await context.db.from('residential_buildings')
      .select('id,complex_id,name,building_no').in('complex_id', ownedComplexIds)
    if (buildingsError) return NextResponse.json({ error: 'LEAD_BUILDING_DETAILS_LOAD_FAILED' }, { status: 500 })
    for (const building of buildings || []) buildingById.set(building.id, building)
  }
  const unitIds = [...new Set(leads.map((lead: any) => lead.unit_id).filter((id: unknown): id is string => typeof id === 'string'))]
  const unitById = new Map<string, any>()
  const validBuildingIds = [...buildingById.keys()]
  if (unitIds.length && validBuildingIds.length) {
    const { data: units, error: unitsError } = await context.db.from('complex_units')
      .select('id,building_id,unit_no,floor,rooms,area_m2,price,currency,status')
      .in('id', unitIds).in('building_id', validBuildingIds)
    if (unitsError) return NextResponse.json({ error: 'LEAD_UNIT_DETAILS_LOAD_FAILED' }, { status: 500 })
    for (const unit of units || []) unitById.set(unit.id, { ...unit, building: buildingById.get(unit.building_id) || null })
  }
  const assigneeIds = [...new Set(leads.map((lead: any) => lead.assigned_to).filter((id: unknown): id is string => typeof id === 'string'))]
  const { data: assignees, error: assigneeError } = assigneeIds.length
    ? await context.db.from('profiles').select('id,full_name,phone').in('id', assigneeIds)
    : { data: [], error: null }
  if (assigneeError) return NextResponse.json({ error: 'LEAD_ASSIGNEES_LOAD_FAILED' }, { status: 500 })
  const assigneeById = new Map((assignees || []).map((profile: any) => [profile.id, profile]))
  return NextResponse.json({
    leads: leads.map((lead: any) => ({
      ...lead,
      complex: lead.complex_id ? complexById.get(lead.complex_id) || null : null,
      unit: lead.unit_id ? unitById.get(lead.unit_id) || null : null,
      assignee: lead.assigned_to ? assigneeById.get(lead.assigned_to) || null : null,
    })),
    role: context.role,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const context = await getDeveloperCrmContext()
  if ('error' in context) return NextResponse.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 403 })
  if (!['owner','admin','sales_manager','sales_agent'].includes(context.role)) {
    return NextResponse.json({ error: 'LEADS_FORBIDDEN' }, { status: 403 })
  }
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'INVALID_LEAD_UPDATE' }, { status: 400 })
  const { data: existing, error: lookupError } = await context.db.from('developer_lead_requests')
    .select('id,assigned_to').eq('id', id).eq('developer_id', context.developer.id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'LEAD_LOOKUP_FAILED' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  if (context.role === 'sales_agent' && existing.assigned_to !== context.userId) {
    return NextResponse.json({ error: 'LEAD_NOT_ASSIGNED_TO_USER' }, { status: 403 })
  }
  const update: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: context.userId }
  if (typeof body.status === 'string') {
    if (!allowedStatuses.includes(body.status)) return NextResponse.json({ error: 'INVALID_LEAD_STATUS' }, { status: 400 })
    update.status = body.status
    if (['won','lost'].includes(body.status)) update.closed_at = new Date().toISOString()
    else update.closed_at = null
  }
  if (body.priority !== undefined) {
    if (!['owner','admin','sales_manager'].includes(context.role)) return NextResponse.json({ error: 'LEAD_PRIORITY_FORBIDDEN' }, { status: 403 })
    if (!['low','normal','high','urgent'].includes(body.priority)) return NextResponse.json({ error: 'INVALID_LEAD_PRIORITY' }, { status: 400 })
    update.priority = body.priority
  }
  let assignmentChange: string | null | undefined
  if (body.assigned_to !== undefined) {
    if (!['owner','admin','sales_manager'].includes(context.role)) return NextResponse.json({ error: 'LEAD_ASSIGNMENT_FORBIDDEN' }, { status: 403 })
    const assignee = typeof body.assigned_to === 'string' && body.assigned_to ? body.assigned_to : null
    if (assignee && assignee !== context.userId) {
      const { data: member, error } = await context.db.from('developer_team_members').select('id')
        .eq('developer_id', context.developer.id).eq('user_id', assignee).eq('status', 'active').maybeSingle()
      if (error) return NextResponse.json({ error: 'ASSIGNEE_LOOKUP_FAILED' }, { status: 500 })
      if (!member) return NextResponse.json({ error: 'ASSIGNEE_NOT_ACTIVE' }, { status: 400 })
    }
    if (assignee !== existing.assigned_to) assignmentChange = assignee
  }
  if (body.next_follow_up_at !== undefined) {
    const value = body.next_follow_up_at
    if (value !== null && (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime()))) {
      return NextResponse.json({ error: 'INVALID_FOLLOW_UP_DATE' }, { status: 400 })
    }
    update.next_follow_up_at = value
  }
  if (body.lost_reason !== undefined) {
    if (typeof body.lost_reason !== 'string' || body.lost_reason.length > 1000) return NextResponse.json({ error: 'INVALID_LOST_REASON' }, { status: 400 })
    update.lost_reason = body.lost_reason.trim() || null
  }
  if (Object.keys(update).length === 2) return NextResponse.json({ error: 'NO_LEAD_CHANGES' }, { status: 400 })
  if (assignmentChange !== undefined) {
    if (Object.keys(update).length > 2) {
      const { error: fieldError } = await context.db.from('developer_lead_requests').update(update)
        .eq('id', id).eq('developer_id', context.developer.id)
      if (fieldError) return NextResponse.json({ error: 'LEAD_UPDATE_FAILED' }, { status: 500 })
    }
    const { error: assignmentError } = await context.db.rpc('assign_developer_lead', {
      p_developer_id: context.developer.id, p_lead_id: id,
      p_assigned_to: assignmentChange, p_assigned_by: context.userId,
      p_reason: 'CRM manual assignment',
    })
    if (assignmentError) return NextResponse.json({ error: assignmentError.message === 'ASSIGNEE_NOT_ACTIVE' ? 'ASSIGNEE_NOT_ACTIVE' : 'LEAD_ASSIGNMENT_FAILED' }, { status: 400 })
  } else {
    const { error: updateError } = await context.db.from('developer_lead_requests').update(update)
      .eq('id', id).eq('developer_id', context.developer.id)
    if (updateError) return NextResponse.json({ error: 'LEAD_UPDATE_FAILED' }, { status: 500 })
  }
  const { data, error } = await context.db.from('developer_lead_requests')
    .select('id,status,assigned_to,priority,next_follow_up_at,lost_reason,closed_at')
    .eq('id', id).eq('developer_id', context.developer.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'LEAD_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ lead: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const developerId = typeof body?.developer_id === 'string' ? body.developer_id : ''
  const complexId = typeof body?.complex_id === 'string' ? body.complex_id : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const allowedSources = ['prohouse', 'listing', 'complex', 'unit', 'phone', 'chat']
  const source = allowedSources.includes(body?.source) ? body.source : 'complex'

  if (!developerId || !complexId || name.length < 2 || name.length > 160 || phone.length < 7 || phone.length > 40 || message.length > 2000) {
    return NextResponse.json({ error: 'INVALID_LEAD_DATA' }, { status: 400 })
  }

  const db = await createClient()
  const { data: complex, error: complexError } = await db.from('residential_complexes')
    .select('id,developer_id,is_verified')
    .eq('id', complexId)
    .eq('developer_id', developerId)
    .eq('is_verified', true)
    .maybeSingle()
  if (complexError) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_AVAILABLE' }, { status: 404 })

  const { data: { user } } = await db.auth.getUser()
  const { data, error } = await db.from('developer_lead_requests').insert({
    developer_id: developerId,
    complex_id: complexId,
    unit_id: typeof body.unit_id === 'string' ? body.unit_id : null,
    user_id: user?.id || null,
    name,
    phone,
    message: message || null,
    source,
  }).select('id,status,created_at').single()

  if (error) return NextResponse.json({ error: 'LEAD_CREATE_FAILED' }, { status: 400 })
  return NextResponse.json({ lead: data }, { status: 201 })
}
