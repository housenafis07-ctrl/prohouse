import { NextResponse } from 'next/server'
import { getDeveloperCrmContext } from '@/lib/developer/crm-access'

export async function GET(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  let query = ctx.db.from('developer_appointments')
    .select('id,lead_id,complex_id,unit_id,assigned_to,appointment_type,starts_at,ends_at,status,notes,created_at')
    .eq('developer_id', ctx.developer.id).order('starts_at').limit(300)
  if (from) query = query.gte('starts_at', from)
  if (to) query = query.lt('starts_at', to)
  if (ctx.role === 'sales_agent') query = query.eq('assigned_to', ctx.userId)
  if (!['owner','admin','sales_manager','sales_agent'].includes(ctx.role)) {
    return NextResponse.json({ error: 'APPOINTMENTS_FORBIDDEN' }, { status: 403 })
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'APPOINTMENTS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ appointments: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  if (!['owner','admin','sales_manager','sales_agent'].includes(ctx.role)) {
    return NextResponse.json({ error: 'APPOINTMENTS_FORBIDDEN' }, { status: 403 })
  }
  const body = await request.json().catch(() => null)
  const starts = typeof body?.starts_at === 'string' ? new Date(body.starts_at) : null
  const ends = typeof body?.ends_at === 'string' && body.ends_at ? new Date(body.ends_at) : null
  const kind = typeof body?.appointment_type === 'string' ? body.appointment_type : 'viewing'
  const leadId = typeof body?.lead_id === 'string' ? body.lead_id : null
  const complexId = typeof body?.complex_id === 'string' ? body.complex_id : null
  const unitId = typeof body?.unit_id === 'string' ? body.unit_id : null
  const assignedTo = typeof body?.assigned_to === 'string' ? body.assigned_to : ctx.userId
  if (!starts || !Number.isFinite(starts.getTime()) || (ends && (!Number.isFinite(ends.getTime()) || ends <= starts))
    || !['viewing','office_meeting','phone','other'].includes(kind)) {
    return NextResponse.json({ error: 'INVALID_APPOINTMENT' }, { status: 400 })
  }
  if (!canManageAssignments(ctx.role) && assignedTo !== ctx.userId) {
    return NextResponse.json({ error: 'APPOINTMENT_ASSIGNMENT_FORBIDDEN' }, { status: 403 })
  }
  if (leadId) {
    const { data: lead, error } = await ctx.db.from('developer_lead_requests').select('id')
      .eq('id', leadId).eq('developer_id', ctx.developer.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'LEAD_LOOKUP_FAILED' }, { status: 500 })
    if (!lead) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  }
  if (complexId) {
    const { data: complex, error } = await ctx.db.from('residential_complexes').select('id')
      .eq('id', complexId).eq('developer_id', ctx.developer.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
    if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })
  }
  if (unitId) {
    const { data: unit, error } = await ctx.db.from('complex_units').select('id,building_id')
      .eq('id', unitId).maybeSingle()
    if (error) return NextResponse.json({ error: 'UNIT_LOOKUP_FAILED' }, { status: 500 })
    if (!unit) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
    const { data: building, error: buildingError } = await ctx.db.from('residential_buildings')
      .select('complex_id').eq('id', unit.building_id).maybeSingle()
    if (buildingError) return NextResponse.json({ error: 'BUILDING_LOOKUP_FAILED' }, { status: 500 })
    if (!building || (complexId && building.complex_id !== complexId)) {
      return NextResponse.json({ error: 'UNIT_COMPLEX_MISMATCH' }, { status: 400 })
    }
    const { data: owned } = await ctx.db.from('residential_complexes').select('id')
      .eq('id', building.complex_id).eq('developer_id', ctx.developer.id).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'UNIT_NOT_OWNED' }, { status: 404 })
  }
  if (assignedTo !== ctx.userId) {
    const { data: member, error } = await ctx.db.from('developer_team_members').select('id')
      .eq('developer_id', ctx.developer.id).eq('user_id', assignedTo).eq('status', 'active').maybeSingle()
    if (error) return NextResponse.json({ error: 'TEAM_MEMBER_LOOKUP_FAILED' }, { status: 500 })
    if (!member) return NextResponse.json({ error: 'ASSIGNEE_NOT_ACTIVE' }, { status: 400 })
  }
  const { data, error } = await ctx.db.from('developer_appointments').insert({
    developer_id: ctx.developer.id, lead_id: leadId, complex_id: complexId, unit_id: unitId,
    assigned_to: assignedTo, created_by: ctx.userId, appointment_type: kind,
    starts_at: starts.toISOString(), ends_at: ends?.toISOString() || null,
    notes: typeof body?.notes === 'string' ? body.notes.slice(0,3000) : null,
  }).select('id,lead_id,complex_id,unit_id,assigned_to,appointment_type,starts_at,ends_at,status,notes').single()
  if (error) return NextResponse.json({ error: 'APPOINTMENT_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ appointment: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !['scheduled','completed','cancelled','no_show'].includes(status)) {
    return NextResponse.json({ error: 'INVALID_APPOINTMENT_UPDATE' }, { status: 400 })
  }
  if (!['owner','admin','sales_manager','sales_agent'].includes(ctx.role)) {
    return NextResponse.json({ error: 'APPOINTMENTS_FORBIDDEN' }, { status: 403 })
  }
  let query = ctx.db.from('developer_appointments').update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).eq('developer_id', ctx.developer.id)
  if (ctx.role === 'sales_agent') query = query.eq('assigned_to', ctx.userId)
  const { data, error } = await query.select('id,status').maybeSingle()
  if (error) return NextResponse.json({ error: 'APPOINTMENT_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'APPOINTMENT_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ appointment: data })
}
