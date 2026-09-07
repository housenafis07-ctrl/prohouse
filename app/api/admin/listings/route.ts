import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function authorized(request: NextRequest) {
  const configured = process.env.PROHOUSE_ADMIN_PASSWORD
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(configured && supplied && supplied === configured)
}

const select = 'id,listing_code,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,created_at,updated_at,taxonomy_code,moderation_note,moderation_updated_at,owner_id,profiles:owner_id(full_name,phone,company_name,account_type,partner_type,inn),partner_listing_taxonomy(taxonomy_code:code,name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter),listing_images(image_url,sort_order)'

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('listings')
      .select(select)
      .eq('status', 'moderation')
      .order('updated_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ listings: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Moderatsiya navbati yuklanmadi' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    if (!id || !action) return NextResponse.json({ error: 'E’lon va amal ko‘rsatilishi kerak.' }, { status: 400 })
    if (action === 'reject' && !reason) return NextResponse.json({ error: 'Rad etish sababini kiriting.' }, { status: 400 })

    const supabase = adminClient()
    const patch = action === 'approve'
      ? { status: 'active', is_verified: true, published_at: new Date().toISOString(), moderation_note: null, moderation_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { status: 'rejected', is_verified: false, published_at: null, moderation_note: reason, moderation_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('listings')
      .update(patch)
      .eq('id', id)
      .eq('status', 'moderation')
      .select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at')
      .single()

    if (error) throw error
    return NextResponse.json({ listing: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status: 500 })
  }
}
