import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
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
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const { data, error } = await context.db.from('developer_lead_requests')
    .select('id,name,phone,message,status,created_at,complex_id,unit_id')
    .eq('developer_id', context.developer.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'DEVELOPER_LEADS_LOAD_FAILED' }, { status: 500 })
  const leads = data || []
  const complexIds = [...new Set(leads.map((lead: any) => lead.complex_id).filter((id: unknown): id is string => typeof id === 'string'))]
  let complexById = new Map<string, { name: string; slug: string; city: string; district: string | null; is_verified: boolean }>()
  if (complexIds.length) {
    const { data: complexes, error: complexesError } = await context.db
      .from('residential_complexes')
      .select('id,name,slug,city,district,is_verified')
      .eq('developer_id', context.developer.id)
      .in('id', complexIds)
    if (complexesError) return NextResponse.json({ error: 'LEAD_COMPLEX_DETAILS_LOAD_FAILED' }, { status: 500 })
    complexById = new Map((complexes || []).map((complex: any) => [complex.id, complex]))
  }
  const ownedComplexIds = [...complexById.keys()]
  const buildingById = new Map<string, { name: string; building_no: string | null }>()
  if (ownedComplexIds.length) {
    const { data: buildings, error: buildingsError } = await context.db.from('residential_buildings')
      .select('id,complex_id,name,building_no')
      .in('complex_id', ownedComplexIds)
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
  return NextResponse.json({
    leads: leads.map((lead: any) => ({
      ...lead,
      complex: lead.complex_id ? complexById.get(lead.complex_id) || null : null,
      unit: lead.unit_id ? unitById.get(lead.unit_id) || null : null,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'INVALID_LEAD_UPDATE' }, { status: 400 })
  }
  const { data, error } = await context.db.from('developer_lead_requests')
    .update({ status })
    .eq('id', id)
    .eq('developer_id', context.developer.id)
    .select('id,status')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'LEAD_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ lead: data }, { headers: { 'Cache-Control': 'no-store' } })
}

function getClientIp(request: Request) {
  // Vercel supplies x-vercel-forwarded-for at the trusted edge. Fall back to
  // the standard proxy headers for local/staging environments.
  const raw = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || ''
  const ip = raw.split(',')[0]?.trim().replace(/^\[|\]$/g, '').replace(/^::ffff:/i, '')
  return ip && ip.length <= 64 ? ip : null
}

function rateLimitKey(scope: string, ip: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('RATE_LIMIT_SECRET_UNAVAILABLE')
  return createHmac('sha256', secret).update(`developer-lead:${scope}:${ip}`).digest('hex')
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 })
  }
  const ip = getClientIp(request)
  if (!ip) return NextResponse.json({ error: 'RATE_LIMIT_IDENTITY_UNAVAILABLE' }, { status: 503 })

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

  // Enforce an atomic 5-submission / 15-minute limit per client IP.
  // Only an HMAC digest is persisted; raw IP addresses are never stored.
  const limiter = serviceClient()
  const { data: allowed, error: limitError } = await limiter.rpc('consume_public_api_rate_limit', {
    p_bucket_key: rateLimitKey('ip', ip),
    p_max_requests: 5,
    p_window_seconds: 900,
  })
  if (limitError || typeof allowed !== 'boolean') {
    console.error('[developer-leads] rate limiter unavailable', limitError)
    return NextResponse.json({ error: 'LEAD_SUBMISSION_TEMPORARILY_UNAVAILABLE' }, { status: 503 })
  }
  if (!allowed) {
    return NextResponse.json(
      { error: 'LEAD_RATE_LIMITED', message: 'Juda ko‘p so‘rov yuborildi. 15 daqiqadan keyin qayta urinib ko‘ring.' },
      { status: 429, headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' } }
    )
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
