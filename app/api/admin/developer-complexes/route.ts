import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'revision_requested'])

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const db = serviceClient()
  const { data: complexes, error: queryError } = await db
    .from('residential_complexes')
    .select('id,developer_id,name,slug,city,district,address,description,status,completion_year,total_buildings,total_units,is_verified,moderation_status,moderation_note,moderated_at,moderated_by,latitude,longitude,map_data,created_at,updated_at')
    .order('created_at', { ascending: false })
  if (queryError) return NextResponse.json({ error: 'COMPLEXES_LOAD_FAILED' }, { status: 500 })

  const developerIds = [...new Set((complexes || []).map(row => row.developer_id).filter(Boolean))]
  const { data: developers, error: developerError } = developerIds.length
    ? await db.from('developer_profiles').select('id,developer_name,verification_status,partner_profile_id').in('id', developerIds)
    : { data: [], error: null }
  if (developerError) return NextResponse.json({ error: 'COMPLEX_DEVELOPERS_LOAD_FAILED' }, { status: 500 })

  const developerMap = new Map((developers || []).map(row => [row.id, row]))
  const ids = (complexes || []).map(row => row.id)
  const { data: buildings, error: buildingsError } = ids.length
    ? await db.from('residential_buildings').select('id,complex_id,name,building_no,floors,units_total').in('complex_id', ids)
    : { data: [], error: null }
  if (buildingsError) return NextResponse.json({ error: 'COMPLEX_BUILDINGS_LOAD_FAILED' }, { status: 500 })

  const buildingMap = new Map<string, typeof buildings>()
  for (const building of buildings || []) {
    const current = buildingMap.get(building.complex_id) || []
    current.push(building)
    buildingMap.set(building.complex_id, current)
  }

  return NextResponse.json({
    complexes: (complexes || []).map(complex => ({
      ...complex,
      developer: developerMap.get(complex.developer_id) || null,
      buildings: buildingMap.get(complex.id) || [],
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.complexId === 'string' ? body.complexId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (!id) return NextResponse.json({ error: 'COMPLEX_ID_REQUIRED' }, { status: 400 })
  if (!REVIEW_STATUSES.has(status)) return NextResponse.json({ error: 'INVALID_REVIEW_STATUS' }, { status: 400 })
  if ((status === 'rejected' || status === 'revision_requested') && !note) {
    return NextResponse.json({ error: 'REVIEW_NOTE_REQUIRED' }, { status: 400 })
  }
  if (note.length > 2000) return NextResponse.json({ error: 'REVIEW_NOTE_TOO_LONG' }, { status: 400 })

  const db = serviceClient()
  const { data: existing, error: lookupError } = await db
    .from('residential_complexes')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'COMPLEX_LOOKUP_FAILED' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })

  const now = new Date().toISOString()
  const approved = status === 'approved'
  const { error: updateError } = await db.from('residential_complexes').update({
    moderation_status: status,
    moderation_note: note || null,
    moderated_at: now,
    moderated_by: admin.user.id,
    is_verified: approved,
  }).eq('id', id)
  if (updateError) return NextResponse.json({ error: 'COMPLEX_REVIEW_FAILED' }, { status: 500 })

  return NextResponse.json({ ok: true, status, reviewedAt: now }, { headers: { 'Cache-Control': 'no-store' } })
}
