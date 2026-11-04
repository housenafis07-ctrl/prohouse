import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles').select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 })
  if (!account || account.account_type !== 'partner') return NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 })
  const { data: partner, error: partnerError } = await db.from('partner_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 })
  const { data: developer, error: developerError } = await db.from('developer_profiles').select('id,user_id,verification_status').eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!developer || developer.verification_status !== 'verified') return NextResponse.json({ error: 'DEVELOPER_NOT_APPROVED' }, { status: 403 })
  if (developer.user_id && developer.user_id !== userId) return NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 })

  const { id } = await params
  const { data: complex, error: complexError } = await db.from('residential_complexes')
    .select('id,name,city,address,description,completion_year,latitude,longitude,map_data,moderation_status')
    .eq('id', id).eq('developer_id', developer.id).maybeSingle()
  if (complexError) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })
  if (!['draft', 'revision_requested', 'rejected'].includes(complex.moderation_status)) {
    return NextResponse.json({ error: 'COMPLEX_CANNOT_BE_SUBMITTED', status: complex.moderation_status }, { status: 409 })
  }

  const missing: string[] = []
  if (!complex.name?.trim() || !complex.city?.trim() || !complex.address?.trim()) missing.push('Majmua nomi, hududi va to‘liq manzil')
  if (!complex.description || complex.description.trim().length < 30) missing.push('Loyiha tavsifi (kamida 30 belgi)')
  if (!complex.completion_year) missing.push('Topshirish yili')
  if (complex.latitude == null || complex.longitude == null) missing.push('Xaritadagi majmua joylashuvi')

  const features = Array.isArray(complex.map_data?.features) ? complex.map_data.features : []
  const hasComplexPolygon = features.some((f: any) => f?.type === 'Feature' && f?.properties?.kind === 'complex' && f?.geometry?.type === 'Polygon')
  if (!hasComplexPolygon) missing.push('Majmua hududining xarita konturi')

  const { data: buildings, error: buildingsError } = await db.from('residential_buildings')
    .select('id,name,floors,units_total').eq('complex_id', id)
  if (buildingsError) return NextResponse.json({ error: 'BUILDINGS_LOOKUP_FAILED' }, { status: 500 })
  if (!buildings?.length) missing.push('Kamida bitta korpus')
  const buildingIds = new Set((buildings || []).map((b: any) => b.id))
  for (const building of buildings || []) {
    if (!building.floors || !building.units_total) missing.push(`${building.name}: qavatlar va xonadonlar soni`)
    const linked = features.some((f: any) => f?.type === 'Feature' && f?.properties?.kind === 'building' && f?.properties?.building_id === building.id && f?.geometry?.type === 'Polygon')
    if (!linked) missing.push(`${building.name}: xaritadagi korpus konturini bog‘lash`)
  }

  const { count, error: unitsError } = await db.from('complex_units').select('id', { count: 'exact', head: true }).in('building_id', [...buildingIds])
  if (unitsError) return NextResponse.json({ error: 'INVENTORY_LOOKUP_FAILED' }, { status: 500 })
  if (!count) missing.push('Kamida bitta xonadon inventari (xonalar, maydon va narx ma’lumotlari bilan)')

  if (missing.length) return NextResponse.json({ error: 'COMPLEX_INCOMPLETE', missing }, { status: 422 })

  const { error: updateError } = await db.from('residential_complexes').update({
    moderation_status: 'pending',
    moderation_note: null,
    moderated_at: null,
    moderated_by: null,
    is_verified: false,
  }).eq('id', id).eq('developer_id', developer.id)
  if (updateError) return NextResponse.json({ error: 'COMPLEX_SUBMISSION_FAILED' }, { status: 500 })

  return NextResponse.json({ ok: true, status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } })
}
