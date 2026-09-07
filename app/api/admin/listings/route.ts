import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const select = 'id,listing_code,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,created_at,updated_at,taxonomy_code,moderation_note,moderation_updated_at,owner_id,partner_listing_taxonomy(name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter),listing_images(image_url,sort_order)'

export async function GET() {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  try {
    const { data, error: dbError } = await serviceClient().from('listings').select(select).eq('status', 'moderation').order('updated_at', { ascending: true })
    if (dbError) throw dbError
    return NextResponse.json({ listings: data ?? [] })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya navbati yuklanmadi' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!id || !action) return NextResponse.json({ error: 'E’lon va amal ko‘rsatilishi kerak.' }, { status: 400 })
    if (action === 'reject' && !reason) return NextResponse.json({ error: 'Rad etish sababini kiriting.' }, { status: 400 })
    const now = new Date().toISOString()
    const patch = action === 'approve'
      ? { status: 'active', is_verified: true, published_at: now, moderation_note: null, moderation_updated_at: now, updated_at: now }
      : { status: 'rejected', is_verified: false, published_at: null, moderation_note: reason, moderation_updated_at: now, updated_at: now }
    const { data, error: dbError } = await serviceClient().from('listings').update(patch).eq('id', id).eq('status', 'moderation').select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at').single()
    if (dbError) throw dbError
    return NextResponse.json({ listing: data })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status: 500 }) }
}
