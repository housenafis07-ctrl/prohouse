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
  const { data: developer, error: developerError } = await db.from('developer_profiles').select('id,user_id,verification_status').eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.verification_status !== 'verified') return { error: NextResponse.json({ error: 'DEVELOPER_NOT_APPROVED' }, { status: 403 }) }
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
    .select('id,unit_no,floor,rooms,area_m2,price,currency,status,building_id,plan_url,details')
    .in('building_id', buildingIds).order('building_id').order('floor')
  if (unitError) return NextResponse.json({ error: 'UNITS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ complexes, buildings: buildings || [], units: units || [] }, { headers: { 'Cache-Control': 'no-store' } })
}


function parseUnitDetails(body: any) {
  const balconyType = typeof body.balcony_type === 'string' ? body.balcony_type : 'none'
  const bathroomCount = body.bathroom_count === '' || body.bathroom_count == null ? null : Number(body.bathroom_count)
  const finishingStatus = typeof body.finishing_status === 'string' ? body.finishing_status : 'shell'
  const downPayment = body.down_payment === '' || body.down_payment == null ? null : Number(body.down_payment)
  const installmentMonths = body.installment_months === '' || body.installment_months == null ? null : Number(body.installment_months)
  const installmentNote = typeof body.installment_note === 'string' ? body.installment_note.trim() : ''
  const installmentEnabled = body.installment_enabled === true
  if (!['none', 'balcony', 'loggia'].includes(balconyType)) return { error: 'BALCONY_TYPE_INVALID' }
  if (bathroomCount !== null && (!Number.isInteger(bathroomCount) || bathroomCount < 0 || bathroomCount > 10)) return { error: 'BATHROOM_COUNT_INVALID' }
  if (!['shell', 'white_box', 'renovated'].includes(finishingStatus)) return { error: 'FINISHING_STATUS_INVALID' }
  if (downPayment !== null && (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > 1000000000000)) return { error: 'DOWN_PAYMENT_INVALID' }
  if (installmentMonths !== null && (!Number.isInteger(installmentMonths) || installmentMonths < 0 || installmentMonths > 360)) return { error: 'INSTALLMENT_MONTHS_INVALID' }
  if (installmentNote.length > 500) return { error: 'INSTALLMENT_NOTE_TOO_LONG' }
  return { value: { balcony_type: balconyType, bathroom_count: bathroomCount, finishing_status: finishingStatus, installment_enabled: installmentEnabled, down_payment: installmentEnabled ? downPayment : null, installment_months: installmentEnabled ? installmentMonths : null, installment_note: installmentEnabled ? (installmentNote || null) : null } }
}

export async function PATCH(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id || !body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_UNIT_UPDATE' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body.status !== 'string' || !unitStatuses.includes(body.status)) return NextResponse.json({ error: 'UNIT_STATUS_INVALID' }, { status: 400 })
    update.status = body.status
  }

  const editingFields = ['unit_no', 'floor', 'rooms', 'area_m2', 'price', 'currency', 'plan_url', 'balcony_type', 'bathroom_count', 'finishing_status', 'down_payment', 'installment_months', 'installment_note']
  const isEditing = editingFields.some(field => Object.prototype.hasOwnProperty.call(body, field))
  if (isEditing) {
    const unitNo = typeof body.unit_no === 'string' ? body.unit_no.trim() : ''
    const floor = body.floor === '' || body.floor == null ? null : Number(body.floor)
    const rooms = body.rooms === '' || body.rooms == null ? null : Number(body.rooms)
    const area = body.area_m2 === '' || body.area_m2 == null ? null : Number(body.area_m2)
    const price = body.price === '' || body.price == null ? null : Number(body.price)
    const currency = typeof body.currency === 'string' ? body.currency : 'USD'
    const planUrl = typeof body.plan_url === 'string' ? body.plan_url.trim() : ''
    if (unitNo.length > 40) return NextResponse.json({ error: 'UNIT_NUMBER_INVALID' }, { status: 400 })
    if (floor !== null && (!Number.isInteger(floor) || floor < 0 || floor > 250)) return NextResponse.json({ error: 'FLOOR_INVALID' }, { status: 400 })
    if (rooms !== null && (!Number.isFinite(rooms) || rooms <= 0 || rooms > 20)) return NextResponse.json({ error: 'ROOMS_INVALID' }, { status: 400 })
    if (area !== null && (!Number.isFinite(area) || area <= 0 || area > 10000)) return NextResponse.json({ error: 'AREA_INVALID' }, { status: 400 })
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000000000)) return NextResponse.json({ error: 'PRICE_INVALID' }, { status: 400 })
    if (!['USD', 'UZS', 'EUR'].includes(currency)) return NextResponse.json({ error: 'CURRENCY_INVALID' }, { status: 400 })
    if (planUrl && (!/^https?:\\/\\//i.test(planUrl) || planUrl.length > 1000)) return NextResponse.json({ error: 'PLAN_URL_INVALID' }, { status: 400 })
    const parsed = parseUnitDetails(body)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    Object.assign(update, { unit_no: unitNo || null, floor, rooms, area_m2: area, price, currency, plan_url: planUrl || null, details: parsed.value })
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'NO_UNIT_FIELDS_TO_UPDATE' }, { status: 400 })

  const owned = await getOwnedBuildingIds(context.db, context.developer.id)
  if ('error' in owned) return NextResponse.json({ error: 'INVENTORY_OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  if (!owned.ids.length) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
  const { data, error } = await context.db.from('complex_units').update(update)
    .eq('id', id).in('building_id', owned.ids)
    .select('id,unit_no,floor,rooms,area_m2,price,currency,status,building_id,plan_url,details').maybeSingle()
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
  if (planUrl && (!/^https?:\\/\\//i.test(planUrl) || planUrl.length > 1000)) return NextResponse.json({ error: 'PLAN_URL_INVALID' }, { status: 400 })
  const parsed = parseUnitDetails(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const owned = await getOwnedBuildingIds(context.db, context.developer.id)
  if ('error' in owned) return NextResponse.json({ error: 'INVENTORY_OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  if (!owned.ids.includes(buildingId)) return NextResponse.json({ error: 'BUILDING_NOT_FOUND' }, { status: 404 })

  const { data, error } = await context.db.from('complex_units').insert({
    building_id: buildingId, unit_no: unitNo || null, floor, rooms, area_m2: area, price, currency,
    plan_url: planUrl || null, details: parsed.value, status: 'available',
  }).select('id,unit_no,floor,rooms,area_m2,price,currency,status,building_id,plan_url,details').single()
  if (error) return NextResponse.json({ error: 'UNIT_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ unit: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
