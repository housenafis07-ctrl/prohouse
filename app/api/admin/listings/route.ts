import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const select = 'id,listing_code,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,created_at,updated_at,taxonomy_code,moderation_note,moderation_updated_at,owner_id,ownership_type,draft_data,views_count,accommodation_type,max_guests,sold_or_rented_at,partner_listing_taxonomy(name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter),listing_images(id,image_url,sort_order,storage_path),listing_media(id,media_type,status,provider,processed_storage_path,playback_url,thumbnail_storage_path,duration_seconds,width,height,sort_order)'

async function enrichListing(db: ReturnType<typeof serviceClient>, item: Record<string, any>) {
  const ownerId = item.owner_id as string | null
  if (!ownerId) return { ...item, partner: null, partner_stats: null, verification: null, moderation_history: [] }

  const [profileResult, partnerResult, docsResult, statsResult, historyResult] = await Promise.all([
    db.from('profiles').select('id,profile_code,full_name,phone,account_type,partner_type,company_name,inn,verification_status,myid_status,myid_verified_at,trusted_profile,trusted_profile_verified_at').eq('id', ownerId).maybeSingle(),
    db.from('partner_profiles').select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_reviewed_at').eq('user_id', ownerId).maybeSingle(),
    db.from('partner_verification_documents').select('id,partner_profile_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,storage_path,created_at,reviewed_at').eq('user_id', ownerId).order('created_at', { ascending: false }),
    db.from('listings').select('status').eq('owner_id', ownerId),
    db.from('listing_moderation_history').select('id,admin_id,from_status,to_status,reason,created_at').eq('listing_id', item.id).order('created_at', { ascending: false }).limit(20),
  ])

  if (profileResult.error) throw profileResult.error
  if (partnerResult.error) throw partnerResult.error
  if (docsResult.error) throw docsResult.error
  if (statsResult.error) throw statsResult.error
  if (historyResult.error) throw historyResult.error

  const profile = profileResult.data
  const partner = partnerResult.data
  const statsRows = statsResult.data || []
  const partnerStats = {
    total: statsRows.length,
    active: statsRows.filter(x => x.status === 'active').length,
    moderation: statsRows.filter(x => x.status === 'moderation').length,
    draft: statsRows.filter(x => x.status === 'draft').length,
    rejected: statsRows.filter(x => x.status === 'rejected').length,
    sold_or_rented: statsRows.filter(x => ['sold', 'rented', 'sold_or_rented'].includes(x.status)).length,
  }

  const verificationDocs = await Promise.all((docsResult.data || []).map(async doc => {
    const signed = doc.storage_path ? await db.storage.from('partner-verification-documents').createSignedUrl(doc.storage_path, 900) : { data: null, error: null }
    return { id: doc.id, document_type: doc.document_type, file_name: doc.file_name, status: doc.status, signed_url: signed.data?.signedUrl || null, created_at: doc.created_at, reviewed_at: doc.reviewed_at }
  }))

  const adminIds = [...new Set((historyResult.data || []).map(h => h.admin_id).filter(Boolean))]
  const { data: adminProfiles, error: adminProfilesError } = adminIds.length ? await db.from('profiles').select('id,full_name').in('id', adminIds) : { data: [], error: null }
  if (adminProfilesError) throw adminProfilesError
  const adminNames = new Map((adminProfiles || []).map(x => [x.id, x.full_name]))
  const moderationHistory = (historyResult.data || []).map(h => ({ ...h, admin_name: h.admin_id ? adminNames.get(h.admin_id) || null : null }))

  return {
    ...item,
    partner: {
      partner_profile_id: partner?.id || null,
      profile_code: profile?.profile_code || null,
      owner_id: ownerId,
      account_type: profile?.account_type || null,
      partner_type: partner?.partner_type || profile?.partner_type || null,
      legal_form: partner?.legal_form || null,
      display_name: partner?.display_name || profile?.company_name || profile?.full_name || item.seller_name || null,
      company_name: partner?.company_name || profile?.company_name || null,
      full_name: profile?.full_name || null,
      phone: profile?.phone || item.seller_phone || null,
      inn: profile?.inn || null,
      verification_status: partner?.verification_status || profile?.verification_status || null,
      trusted_status: partner?.trusted_partner_status || (profile?.trusted_profile ? 'verified' : null),
    },
    partner_stats: partnerStats,
    verification: {
      myid_status: profile?.myid_status || null,
      myid_verified_at: profile?.myid_verified_at || null,
      trusted_profile: Boolean(profile?.trusted_profile),
      trusted_profile_verified_at: profile?.trusted_profile_verified_at || null,
      partner_verification_status: partner?.verification_status || null,
      trusted_partner_status: partner?.trusted_partner_status || null,
      documents: verificationDocs,
    },
    moderation_history: moderationHistory,
  }
}

export async function GET() {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const { data, error: dbError } = await db.from('listings').select(select).eq('status', 'moderation').order('updated_at', { ascending: true })
    if (dbError) throw dbError

    const listings = (data || []) as Array<Record<string, any>>
    const ownerIds = [...new Set(listings.map(item => item.owner_id).filter(Boolean))]
    const priorityOwnerIds = new Set<string>()

    if (ownerIds.length) {
      const { data: priorityPlans, error: planError } = await db.from('monetization_entitlements').select('user_id,product_code,ends_at,monetization_products!inner(code,product_type,audience,active,metadata)').in('user_id', ownerIds).eq('status', 'active').not('ends_at', 'is', null).gt('ends_at', new Date().toISOString())
      if (planError) throw planError
      for (const entitlement of priorityPlans || []) {
        const product = Array.isArray(entitlement.monetization_products) ? entitlement.monetization_products[0] : entitlement.monetization_products
        if (product?.product_type === 'subscription' && product?.audience === 'partner' && product?.active && product?.metadata?.priority_moderation === true) priorityOwnerIds.add(entitlement.user_id)
      }
    }

    const normalized = await Promise.all(listings.map(async item => {
      const draft = item.draft_data && typeof item.draft_data === 'object' ? item.draft_data as Record<string, any> : {}
      const attributes = draft.attributes && typeof draft.attributes === 'object' ? draft.attributes as Record<string, any> : {}
      const ownershipType = item.ownership_type || draft.ownership_type || attributes.ownership_type || null
      return enrichListing(db, {
        ...item,
        moderation_priority: priorityOwnerIds.has(item.owner_id) ? 100 : 0,
        city: item.city || draft.city || null,
        district: item.district || draft.district || null,
        neighborhood: item.neighborhood || draft.neighborhood || null,
        address: item.address || draft.address || null,
        latitude: item.latitude ?? (typeof draft.latitude === 'number' ? draft.latitude : Number.isFinite(Number(draft.latitude)) ? Number(draft.latitude) : null),
        longitude: item.longitude ?? (typeof draft.longitude === 'number' ? draft.longitude : Number.isFinite(Number(draft.longitude)) ? Number(draft.longitude) : null),
        ownership_type: ownershipType,
        seller_type: item.seller_type || (ownershipType === 'owner' ? 'owner' : null),
      })
    }))

    normalized.sort((a, b) => b.moderation_priority - a.moderation_priority || new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    return NextResponse.json({ listings: normalized })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya navbati yuklanmadi' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!id || !action) return NextResponse.json({ error: 'E’lon va amal ko‘rsatilishi kerak.' }, { status: 400 })
    if (action === 'reject' && !reason) return NextResponse.json({ error: 'Rad etish sababini kiriting.' }, { status: 400 })

    const db = serviceClient()
    const { data: current, error: currentError } = await db.from('listings').select('id,listing_code,status').eq('id', id).single()
    if (currentError) throw currentError
    if (current.status !== 'moderation') return NextResponse.json({ error: 'E’lon allaqachon moderatsiya navbatidan chiqarilgan.' }, { status: 409 })

    const now = new Date().toISOString()
    const nextStatus = action === 'approve' ? 'active' : 'draft'
    const patch = action === 'approve'
      ? { status: 'active', is_verified: true, published_at: now, moderation_note: null, moderation_updated_at: now, updated_at: now }
      : { status: 'draft', is_verified: false, published_at: null, moderation_note: reason, moderation_updated_at: now, updated_at: now }

    const { data, error: dbError } = await db.from('listings').update(patch).eq('id', id).eq('status', 'moderation').select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at').single()
    if (dbError) throw dbError

    const { error: historyError } = await db.from('listing_moderation_history').insert({ listing_id: id, admin_id: admin?.user?.id || null, from_status: current.status, to_status: nextStatus, reason: action === 'reject' ? reason : null })
    if (historyError) throw historyError

    return NextResponse.json({ listing: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status: 500 })
  }
}
