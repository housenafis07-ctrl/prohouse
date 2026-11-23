import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

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
    .select('id,user_id,verification_status').eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.verification_status !== 'verified') {
    return { error: NextResponse.json({ error: 'DEVELOPER_NOT_APPROVED' }, { status: 403 }) }
  }
  if (developer.user_id && developer.user_id !== userId) {
    return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 }) }
  }
  return { db, developer, userId }
}

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const { leadId } = await params
  const { data: lead, error: leadError } = await context.db.from('developer_lead_requests')
    .select('id').eq('id', leadId).eq('developer_id', context.developer.id).maybeSingle()
  if (leadError) return NextResponse.json({ error: 'LEAD_LOOKUP_FAILED' }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })

  const [notesResult, activitiesResult] = await Promise.all([
    context.db.from('developer_lead_notes').select('id,body,author_user_id,created_at')
      .eq('lead_id', leadId).eq('developer_id', context.developer.id).order('created_at', { ascending: false }),
    context.db.from('developer_lead_activities').select('id,activity_type,summary,actor_user_id,created_at')
      .eq('lead_id', leadId).eq('developer_id', context.developer.id).order('created_at', { ascending: false }),
  ])
  if (notesResult.error || activitiesResult.error) {
    return NextResponse.json({ error: 'LEAD_ACTIVITY_LOAD_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ notes: notesResult.data || [], activities: activitiesResult.data || [] },
    { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, { params }: RouteContext) {
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const { leadId } = await params
  const { data: lead, error: leadError } = await context.db.from('developer_lead_requests')
    .select('id').eq('id', leadId).eq('developer_id', context.developer.id).maybeSingle()
  if (leadError) return NextResponse.json({ error: 'LEAD_LOOKUP_FAILED' }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (body?.kind === 'note') {
    const note = typeof body.body === 'string' ? body.body.trim() : ''
    if (!note || note.length > 4000) return NextResponse.json({ error: 'INVALID_NOTE' }, { status: 400 })
    const { data, error } = await context.db.from('developer_lead_notes').insert({
      lead_id: leadId, developer_id: context.developer.id, author_user_id: context.userId, body: note,
    }).select('id,body,author_user_id,created_at').single()
    if (error) return NextResponse.json({ error: 'LEAD_NOTE_CREATE_FAILED' }, { status: 500 })
    return NextResponse.json({ note: data }, { status: 201 })
  }

  const allowedTypes = ['call', 'message', 'meeting', 'other']
  const activityType = typeof body?.activity_type === 'string' ? body.activity_type : ''
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''
  if (!allowedTypes.includes(activityType) || !summary || summary.length > 1000) {
    return NextResponse.json({ error: 'INVALID_ACTIVITY' }, { status: 400 })
  }
  const { data, error } = await context.db.from('developer_lead_activities').insert({
    lead_id: leadId, developer_id: context.developer.id, actor_user_id: context.userId,
    activity_type: activityType, summary,
  }).select('id,activity_type,summary,actor_user_id,created_at').single()
  if (error) return NextResponse.json({ error: 'LEAD_ACTIVITY_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ activity: data }, { status: 201 })
}
