import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const unitStatuses = ['available', 'reserved', 'sold', 'hidden']

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

async function getOwnedBuildingIds(db: ReturnType<typeof serviceClient>, developerId: string) {
  const { data: complexes, error: complexError } = await db.from('residential_complexes')
    .select('id').eq('developer_id', developerId)
  if (complexError) return { error: true as const }
  const complexIds = (complexes || []).map(x => x.id)
  if (!complexIds.length) return { ids: [] as string[] }
  const { data: buildings, error: buildingError } = await db.from('residential_buildings')
    .select('id').in('complex_id', complexIds)
  if (buildingError) return { error: true as const }
  return { ids: (buildings || []).map(x => x.id) }
}

export async function GET() {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const { data: complexes, error: complexError } = await context.db.from('residential_complexes')
    .select('id,name').eq('developer_id', context.developer.id)
  if (complexError) return NextResponse.json({ error: 'COMPLEX_LIST_FAILED' }, { status: 500 })
  const complexIds = (complexes || []).map(x => x.id)
  if (!complexIds.length) return NextResponse.json({ complexes: [], buildings: [], units: [] })
  const { data: buildings, error: buildingError } = await context.db.from('residential_buildings')
    .select('id,name,complex_id').in('complex_id', complexIds)
  if (buildingError) return NextResponse.json({ error: 'BUILDINGS_LOAD_FAILED' }, { status: 500 })
  const buildingIds = (buildings || []).map(x => x.id)
  if (!buildingIds.length) return NextResponse.json({ complexes, buildings: buildings || [], units: [] })
  const { data: units, error: unitError } = await context.db.from('complex_units')
    .select('id,unit_no,floor,rooms,area_m2,price,currency,status,building_id')
    .in('building_id', buildingIds).order('building_id').order('floor')
  if (unitError) return NextResponse.json({ error: 'UNITS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ complexes, buildings: buildings || [], units: units || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !unitStatuses.includes(status)) return NextResponse.json({ error: 'INVALID_UNIT_UPDATE' }, { status: 400 })
  const owned = await getOwnedBuildingIds(context.db, context.developer.id)
  if ('error' in owned) return NextResponse.json({ error: 'INVENTORY_OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  if (!owned.ids.length) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
  const { data, error } = await context.db.from('complex_units').update({ status })
    .eq('id', id).in('building_id', owned.ids).select('id,status').maybeSingle()
  if (error) return NextResponse.json({ error: 'UNIT_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ unit: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const buildingId = typeof body.building_id === 'string' ? body.building_id : ''
  const unitNo = typeof body.unit_no === 'string' ? body.unit_no.trim() : ''
  const floor = body.floor === '' || body.floor == null ? null : Number(body.floor)
  const rooms = body.rooms === '' || body.rooms == null ? null : Number(body.rooms)
  const area = body.area_m2 === '' || body.area_m2 == null ? null : Number(body.area_m2)
  const price = body.price === '' || body.price == null ? null : Number(body.price)
  const currency = typeof body.currency === 'string' ? body.currency : 'USD'
  const planUrl = typeof body.plan_url === 'string' ? body.plan_url.trim() : ''

  if (!buildingId) return NextResponse.json({ error: 'BUILDING_REQUIRED' }, { status: 400 })
  if (unitNo.length > 40) return NextResponse.json({ error: 'UNIT_NUMBER_INVALID' }, { status: 400 })
  if (floor !== null && (!Number.isInteger(floor) || floor < 0 || floor > 250)) return NextResponse.json({ error: 'FLOOR_INVALID' }, { status: 400 })
  if (rooms !== null && (!Number.isFinite(rooms) || rooms <= 0 || rooms > 20)) return NextResponse.json({ error: 'ROOMS_INVALID' }, { status: 400 })
  if (area !== null && (!Number.isFinite(area) || area <= 0 || area > 10000)) return NextResponse.json({ error: 'AREA_INVALID' }, { status: 400 })
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000000000)) return NextResponse.json({ error: 'PRICE_INVALID' }, { status: 400 })
  if (!['USD', 'UZS', 'EUR'].includes(currency)) return NextResponse.json({ error: 'CURRENCY_INVALID' }, { status: 400 })
  if (planUrl && (!/^https?:\/\//i.test(planUrl) || planUrl.length > 1000)) return NextResponse.json({ error: 'PLAN_URL_INVALID' }, { status: 400 })

  const owned = await getOwnedBuildingIds(context.db, context.developer.id)
  if ('error' in owned) return NextResponse.json({ error: 'INVENTORY_OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  if (!owned.ids.includes(buildingId)) return NextResponse.json({ error: 'BUILDING_NOT_FOUND' }, { status: 404 })

  const { data, error } = await context.db.from('complex_units').insert({
    building_id: buildingId,
    unit_no: unitNo || null,
    floor,
    rooms,
    area_m2: area,
    price,
    currency,
    plan_url: planUrl || null,
    status: 'available',
  }).select('id,unit_no,floor,rooms,area_m2,price,currency,status,building_id').single()
  if (error) return NextResponse.json({ error: 'UNIT_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ unit: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
