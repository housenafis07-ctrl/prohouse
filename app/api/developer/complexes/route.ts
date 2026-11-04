import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function getDeveloper() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }

  const db = serviceClient()
  const { data: account, error: accountError } = await db
    .from('profiles').select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 }) }
  if (!account || account.account_type !== 'partner') {
    return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  }

  const { data: partner, error: partnerError } = await db
    .from('partner_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }

  const { data: developer, error: developerError } = await db
    .from('developer_profiles')
    .select('id,user_id,developer_name,verification_status')
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
  return { db, userId, developer }
}

export async function GET() {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const { data, error } = await context.db
    .from('residential_complexes')
    .select('id,name,slug,city,district,address,status,completion_year,is_verified,latitude,longitude,map_data,created_at')
    .eq('developer_id', context.developer.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'COMPLEX_LIST_FAILED' }, { status: 500 })
  return NextResponse.json({ complexes: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

export async function POST(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const district = typeof body.district === 'string' ? body.district.trim() : ''
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const completionYear = body.completion_year === '' || body.completion_year == null ? null : Number(body.completion_year)\n  const latitude = body.latitude == null ? null : Number(body.latitude)\n  const longitude = body.longitude == null ? null : Number(body.longitude)\n  const mapData = body.map_data && typeof body.map_data === 'object' ? body.map_data : { type: 'FeatureCollection', features: [] }

  if (name.length < 2 || name.length > 180) return NextResponse.json({ error: 'COMPLEX_NAME_INVALID' }, { status: 400 })
  if (!city || city.length > 120) return NextResponse.json({ error: 'CITY_REQUIRED' }, { status: 400 })
  if (district.length > 120 || address.length > 500 || description.length > 8000) {
    return NextResponse.json({ error: 'FIELD_TOO_LONG' }, { status: 400 })
  }
  if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {\n    return NextResponse.json({ error: 'MAP_COORDINATES_INVALID' }, { status: 400 })\n  }\n  if (mapData.type !== 'FeatureCollection' || !Array.isArray(mapData.features) || mapData.features.length > 100) {\n    return NextResponse.json({ error: 'MAP_DATA_INVALID' }, { status: 400 })\n  }\n  const currentYear = new Date().getFullYear()
  if (completionYear !== null && (!Number.isInteger(completionYear) || completionYear < currentYear - 5 || completionYear > currentYear + 30)) {
    return NextResponse.json({ error: 'COMPLETION_YEAR_INVALID' }, { status: 400 })
  }

  const db = context.db
  const base = slugify(name) || 'residential-complex'
  let slug = base
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const { data: found, error } = await db.from('residential_complexes').select('id').eq('slug', candidate).maybeSingle()
    if (error) return NextResponse.json({ error: 'SLUG_CHECK_FAILED' }, { status: 500 })
    if (!found) { slug = candidate; break }
    if (attempt === 7) return NextResponse.json({ error: 'SLUG_UNAVAILABLE' }, { status: 409 })
  }

  const { data, error } = await db.from('residential_complexes').insert({
    developer_id: context.developer.id,
    name,
    slug,
    city,
    district: district || null,
    address: address || null,
    description: description || null,
    completion_year: completionYear,
    status: 'planning',
  }).select('id,name,slug,city,district,address,status,completion_year,latitude,longitude,map_data,created_at').single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'SLUG_CONFLICT_RETRY' }, { status: 409 })
    return NextResponse.json({ error: 'COMPLEX_CREATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ complex: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
