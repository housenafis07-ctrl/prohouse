import { NextResponse } from 'next/server'
import { canManageAssignments, getDeveloperCrmContext } from '@/lib/developer/crm-access'

export async function GET(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  let query = ctx.db.from('developer_tasks')
    .select('id,lead_id,assigned_to,created_by,task_type,title,description,due_at,status,completed_at,created_at')
    .eq('developer_id', ctx.developer.id).order('due_at', { ascending: true }).limit(300)
  if (status && ['open','completed','cancelled'].includes(status)) query = query.eq('status', status)
  if (ctx.role === 'sales_agent') query = query.eq('assigned_to', ctx.userId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'TASKS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ tasks: data || [], role: ctx.role }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const dueAt = typeof body?.due_at === 'string' ? new Date(body.due_at) : null
  const taskType = typeof body?.task_type === 'string' ? body.task_type : 'follow_up'
  const leadId = typeof body?.lead_id === 'string' ? body.lead_id : null
  const assignedTo = typeof body?.assigned_to === 'string' ? body.assigned_to : ctx.userId
  if (title.length < 2 || title.length > 180 || !dueAt || !Number.isFinite(dueAt.getTime())
    || !['call','message','meeting','follow_up','document','other'].includes(taskType)) {
    return NextResponse.json({ error: 'INVALID_TASK' }, { status: 400 })
  }
  if (!canManageAssignments(ctx.role) && assignedTo !== ctx.userId) {
    return NextResponse.json({ error: 'TASK_ASSIGNMENT_FORBIDDEN' }, { status: 403 })
  }
  if (leadId) {
    const { data: lead, error } = await ctx.db.from('developer_lead_requests')
      .select('id').eq('id', leadId).eq('developer_id', ctx.developer.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'LEAD_LOOKUP_FAILED' }, { status: 500 })
    if (!lead) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  }
  if (assignedTo !== ctx.userId) {
    const { data: member, error } = await ctx.db.from('developer_team_members').select('id')
      .eq('developer_id', ctx.developer.id).eq('user_id', assignedTo).eq('status', 'active').maybeSingle()
    if (error) return NextResponse.json({ error: 'TEAM_MEMBER_LOOKUP_FAILED' }, { status: 500 })
    if (!member) return NextResponse.json({ error: 'ASSIGNEE_NOT_ACTIVE' }, { status: 400 })
  }
  const { data, error } = await ctx.db.from('developer_tasks').insert({
    developer_id: ctx.developer.id, lead_id: leadId, assigned_to: assignedTo,
    created_by: ctx.userId, task_type: taskType, title,
    description: typeof body?.description === 'string' ? body.description.slice(0,4000) : null,
    due_at: dueAt.toISOString(),
  }).select('id,lead_id,assigned_to,task_type,title,description,due_at,status,created_at').single()
  if (error) return NextResponse.json({ error: 'TASK_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const ctx = await getDeveloperCrmContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.error === 'AUTH_REQUIRED' ? 401 : 403 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !['open','completed','cancelled'].includes(status)) {
    return NextResponse.json({ error: 'INVALID_TASK_UPDATE' }, { status: 400 })
  }
  let query = ctx.db.from('developer_tasks').update({
    status, completed_at: status === 'completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('developer_id', ctx.developer.id)
  if (ctx.role === 'sales_agent') query = query.eq('assigned_to', ctx.userId)
  const { data, error } = await query.select('id,status,completed_at').maybeSingle()
  if (error) return NextResponse.json({ error: 'TASK_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'TASK_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ task: data })
}
