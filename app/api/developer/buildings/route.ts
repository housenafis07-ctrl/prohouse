import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function getDeveloper() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }
  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles').select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 }) }
  if (!account || account.account_type !== 'partner') return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  const { data: partner, error: partnerError } = await db.from('partner_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }
  const { data: developer, error: developerError } = await db.from('developer_profiles').select('id,user_id').eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.user_id && developer.user_id !== userId) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 }) }
  if (!developer.user_id) {
    const { error } = await db.from('developer_profiles').update({ user_id: userId }).eq('id', developer.id)
    if (error) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LINK_FAILED' }, { status: 500 }) }
  }
  return { db, developer }
}

export async function GET(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const complexId = new URL(request.url).searchParams.get('complex_id')
  if (!complexId) return NextResponse.json({ error: 'COMPLEX_ID_REQUIRED' }, { status: 400 })
  const { data: complex, error: complexError } = await context.db.from('residential_complexes')
    .select('id,name').eq('id', complexId).eq('developer_id', context.developer.id).maybeSingle()
  if (complexError) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })
  const { data, error } = await context.db.from('residential_buildings')
    .select('id,name,building_no,floors,units_total,completion_date,status,created_at')
    .eq('complex_id', complexId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'BUILDINGS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ complex, buildings: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const complexId = typeof body.complex_id === 'string' ? body.complex_id : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const buildingNo = typeof body.building_no === 'string' ? body.building_no.trim() : ''
  const floors = body.floors === '' || body.floors == null ? null : Number(body.floors)
  const unitsTotal = body.units_total === '' || body.units_total == null ? null : Number(body.units_total)
  const completionDate = typeof body.completion_date === 'string' && body.completion_date ? body.completion_date : null
  if (!complexId) return NextResponse.json({ error: 'COMPLEX_ID_REQUIRED' }, { status: 400 })
  if (name.length < 1 || name.length > 120 || buildingNo.length > 40) return NextResponse.json({ error: 'BUILDING_NAME_INVALID' }, { status: 400 })
  if (floors !== null && (!Number.isInteger(floors) || floors < 1 || floors > 200)) return NextResponse.json({ error: 'FLOORS_INVALID' }, { status: 400 })
  if (unitsTotal !== null && (!Number.isInteger(unitsTotal) || unitsTotal < 0 || unitsTotal > 10000)) return NextResponse.json({ error: 'UNITS_TOTAL_INVALID' }, { status: 400 })
  if (completionDate && !/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) return NextResponse.json({ error: 'COMPLETION_DATE_INVALID' }, { status: 400 })

  const { data: complex, error: complexError } = await context.db.from('residential_complexes')
    .select('id').eq('id', complexId).eq('developer_id', context.developer.id).maybeSingle()
  if (complexError) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })

  const { data, error } = await context.db.from('residential_buildings').insert({
    complex_id: complexId,
    name,
    building_no: buildingNo || null,
    floors,
    units_total: unitsTotal,
    completion_date: completionDate,
    status: 'construction',
  }).select('id,name,building_no,floors,units_total,completion_date,status,created_at').single()
  if (error) return NextResponse.json({ error: 'BUILDING_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ building: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
