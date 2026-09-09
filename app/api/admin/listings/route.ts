import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const select = 'id,listing_code,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,created_at,updated_at,taxonomy_code,moderation_note,moderation_updated_at,owner_id,ownership_type,draft_data,views_count,accommodation_type,max_guests,sold_or_rented_at,partner_listing_taxonomy(name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter),listing_images(id,image_url,sort_order,storage_path)'

export async function GET() {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const adminClient = serviceClient()
    const { data, error: dbError } = await adminClient
      .from('listings')
      .select(select)
      .eq('status', 'moderation')
      .order('updated_at', { ascending: true })

    if (dbError) throw dbError

    const listings = (data ?? []) as Array<Record<string, any>>
    const ownerIds = [...new Set(listings.map(item => item.owner_id).filter(Boolean))]
    const profilesById = new Map<string, { full_name: string | null; phone: string | null }>()

    if (ownerIds.length) {
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id,full_name,phone')
        .in('id', ownerIds)
      if (profilesError) throw profilesError
      for (const profile of profiles ?? []) profilesById.set(profile.id, { full_name: profile.full_name, phone: profile.phone })
    }

    // Older drafts may have location only in draft_data. Prefer the persisted
    // listing columns, but fall back to the wizard draft so moderation never
    // loses a selected district such as Mirobod.
    const normalized = listings.map(item => {
      const draft = item.draft_data && typeof item.draft_data === 'object' ? item.draft_data as Record<string, any> : {}
      const attributes = draft.attributes && typeof draft.attributes === 'object' ? draft.attributes as Record<string, any> : {}
      const profile = profilesById.get(item.owner_id)
      const ownershipType = item.ownership_type || draft.ownership_type || attributes.ownership_type || null
      const isOwner = ownershipType === 'owner'

      return {
        ...item,
        city: item.city || draft.city || null,
        district: item.district || draft.district || null,
        neighborhood: item.neighborhood || draft.neighborhood || null,
        address: item.address || draft.address || null,
        latitude: item.latitude ?? (typeof draft.latitude === 'number' ? draft.latitude : Number.isFinite(Number(draft.latitude)) ? Number(draft.latitude) : null),
        longitude: item.longitude ?? (typeof draft.longitude === 'number' ? draft.longitude : Number.isFinite(Number(draft.longitude)) ? Number(draft.longitude) : null),
        ownership_type: ownershipType,
        seller_type: item.seller_type || (isOwner ? 'owner' : null),
        seller_name: item.seller_name || (isOwner ? profile?.full_name || null : null),
        seller_phone: item.seller_phone || (isOwner ? profile?.phone || null : null),
        is_mortgage_available: item.is_mortgage_available ?? (attributes.mortgage === 'true' ? true : attributes.mortgage === 'false' ? false : null),
      }
    })

    return NextResponse.json({ listings: normalized })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya navbati yuklanmadi' }, { status: 500 })
  }
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

    const { data, error: dbError } = await serviceClient()
      .from('listings')
      .update(patch)
      .eq('id', id)
      .eq('status', 'moderation')
      .select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at')
      .single()

    if (dbError) throw dbError
    return NextResponse.json({ listing: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status: 500 })
  }
}
