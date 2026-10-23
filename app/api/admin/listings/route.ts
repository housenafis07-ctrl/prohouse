import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const select = 'id,listing_code,title,title_ru,description,listing_type,property_type,status,price,currency,area_m2,rooms,floor,floors_total,city,district,neighborhood,address,latitude,longitude,seller_type,seller_name,seller_phone,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,created_at,updated_at,taxonomy_code,moderation_note,moderation_updated_at,owner_id,ownership_type,draft_data,views_count,accommodation_type,max_guests,sold_or_rented_at,partner_listing_taxonomy(name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter),listing_images(id,image_url,sort_order,storage_path),listing_media(id,media_type,provider,status,processed_storage_path,playback_url,thumbnail_storage_path,mime_type,original_mime_type,duration_seconds,width,height,size_bytes,sort_order)'

type AnyRow = Record<string, any>

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

    const listings = (data ?? []) as AnyRow[]
    const ownerIds = [...new Set(listings.map(item => item.owner_id).filter(Boolean))]
    const listingIds = listings.map(item => item.id).filter(Boolean)

    const profilesById = new Map<string, AnyRow>()
    const partnerProfilesByUserId = new Map<string, AnyRow>()
    const documentsByUserId = new Map<string, AnyRow[]>()
    const listingCountsByOwner = new Map<string, number>()
    const historyByListing = new Map<string, AnyRow[]>()
    const priorityOwnerIds = new Set<string>()

    if (ownerIds.length) {
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id,profile_code,full_name,phone,account_type,company_name,inn,verification_status,created_at,updated_at')
        .in('id', ownerIds)
      if (profilesError) throw profilesError
      for (const profile of profiles ?? []) profilesById.set(profile.id, profile)

      const { data: partnerProfiles, error: partnerError } = await adminClient
        .from('partner_profiles')
        .select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_rejection_reason,trusted_partner_reviewed_at,updated_at')
        .in('user_id', ownerIds)
      if (partnerError) throw partnerError
      for (const partner of partnerProfiles ?? []) partnerProfilesByUserId.set(partner.user_id, partner)

      const { data: documents, error: documentsError } = await adminClient
        .from('partner_verification_documents')
        .select('id,user_id,partner_profile_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,created_at,reviewed_at')
        .in('user_id', ownerIds)
        .order('created_at', { ascending: false })
      if (documentsError) throw documentsError
      for (const document of documents ?? []) {
        const list = documentsByUserId.get(document.user_id) || []
        list.push(document)
        documentsByUserId.set(document.user_id, list)
      }

      const { data: ownerListings, error: ownerListingsError } = await adminClient
        .from('listings')
        .select('owner_id,status')
        .in('owner_id', ownerIds)
      if (ownerListingsError) throw ownerListingsError
      for (const row of ownerListings ?? []) listingCountsByOwner.set(row.owner_id, (listingCountsByOwner.get(row.owner_id) || 0) + 1)

      const { data: priorityPlans, error: planError } = await adminClient
        .from('monetization_entitlements')
        .select('user_id,product_code,ends_at,monetization_products!inner(code,product_type,audience,active,metadata)')
        .in('user_id', ownerIds)
        .eq('status', 'active')
        .not('ends_at', 'is', null)
        .gt('ends_at', new Date().toISOString())

      if (planError) throw planError
      for (const entitlement of priorityPlans ?? []) {
        const product = Array.isArray(entitlement.monetization_products)
          ? entitlement.monetization_products[0]
          : entitlement.monetization_products
        if (product?.product_type === 'subscription' && product?.audience === 'partner' && product?.active && product?.metadata?.priority_moderation === true) {
          priorityOwnerIds.add(entitlement.user_id)
        }
      }
    }

    if (listingIds.length) {
      const { data: history, error: historyError } = await adminClient
        .from('listing_moderation_history')
        .select('id,listing_id,admin_user_id,from_status,to_status,action,reason,created_at')
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false })
      if (historyError) throw historyError

      const adminIds = [...new Set((history ?? []).map(row => row.admin_user_id).filter(Boolean))]
      const adminProfiles = new Map<string, AnyRow>()
      if (adminIds.length) {
        const { data: adminProfileRows, error: adminProfilesError } = await adminClient
          .from('profiles')
          .select('id,full_name,profile_code,phone')
          .in('id', adminIds)
        if (adminProfilesError) throw adminProfilesError
        for (const profile of adminProfileRows ?? []) adminProfiles.set(profile.id, profile)
      }

      for (const row of history ?? []) {
        const list = historyByListing.get(row.listing_id) || []
        list.push({ ...row, admin: row.admin_user_id ? adminProfiles.get(row.admin_user_id) || null : null })
        historyByListing.set(row.listing_id, list)
      }
    }

    const normalized = [] as AnyRow[]

    for (const item of listings) {
      const draft = item.draft_data && typeof item.draft_data === 'object' ? item.draft_data as AnyRow : {}
      const attributes = draft.attributes && typeof draft.attributes === 'object' ? draft.attributes as AnyRow : {}
      const profile = profilesById.get(item.owner_id) || null
      const partner = partnerProfilesByUserId.get(item.owner_id) || null
      const ownershipType = item.ownership_type || draft.ownership_type || attributes.ownership_type || null
      const isOwner = ownershipType === 'owner'

      const rawMedia = Array.isArray(item.listing_media) ? item.listing_media : []
      const video = rawMedia
        .filter((media: AnyRow) => media.media_type === 'video' && media.status !== 'deleted')
        .sort((a: AnyRow, b: AnyRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] || null

      let videoData = video ? { ...video } : null
      if (videoData && videoData.provider === 'supabase' && videoData.processed_storage_path && videoData.status !== 'uploading') {
        const { data: signed, error: signError } = await adminClient.storage
          .from('listing-videos')
          .createSignedUrl(videoData.processed_storage_path, 60 * 60)
        if (!signError && signed?.signedUrl) videoData.playback_url = signed.signedUrl
      }
      if (videoData && videoData.provider === 'cloudflare' && videoData.processed_storage_path) {
        videoData.playback_url = videoData.playback_url || `https://iframe.videodelivery.net/${videoData.processed_storage_path}`
        videoData.thumbnail_storage_path = videoData.thumbnail_storage_path || `https://videodelivery.net/${videoData.processed_storage_path}/thumbnails/thumbnail.jpg`
      }

      normalized.push({
        ...item,
        moderation_priority: priorityOwnerIds.has(item.owner_id) ? 100 : 0,
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
        partner_id: profile?.profile_code || partner?.id || item.owner_id,
        partner_auth_id: item.owner_id,
        partner_profile: profile ? {
          profile_code: profile.profile_code,
          full_name: profile.full_name,
          phone: profile.phone,
          account_type: profile.account_type,
          company_name: profile.company_name,
          inn: profile.inn,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        } : null,
        partner_business_profile: partner ? {
          id: partner.id,
          partner_type: partner.partner_type,
          legal_form: partner.legal_form,
          display_name: partner.display_name,
          company_name: partner.company_name,
          verification_status: partner.verification_status,
          trusted_partner_status: partner.trusted_partner_status,
          trusted_partner_rejection_reason: partner.trusted_partner_rejection_reason,
          trusted_partner_reviewed_at: partner.trusted_partner_reviewed_at,
          updated_at: partner.updated_at,
        } : null,
        partner_listing_stats: {
          total: listingCountsByOwner.get(item.owner_id) || 0,
          draft: 0,
          moderation: 0,
          active: 0,
          rejected: 0,
          sold: 0,
          rented: 0,
        },
        verification_documents: documentsByUserId.get(item.owner_id) || [],
        moderation_history: historyByListing.get(item.id) || [],
        listing_video: videoData,
      })
    }

    const ownerIdsForStats = [...new Set(normalized.map(item => item.owner_id).filter(Boolean))]
    if (ownerIdsForStats.length) {
      const { data: ownerListingStatuses, error: statusError } = await adminClient
        .from('listings')
        .select('owner_id,status')
        .in('owner_id', ownerIdsForStats)
      if (statusError) throw statusError
      const statsByOwner = new Map<string, AnyRow>()
      for (const row of ownerListingStatuses ?? []) {
        const stats = statsByOwner.get(row.owner_id) || { total: 0, draft: 0, moderation: 0, active: 0, rejected: 0, sold: 0, rented: 0 }
        stats.total += 1
        if (row.status in stats) stats[row.status] += 1
        statsByOwner.set(row.owner_id, stats)
      }
      for (const item of normalized) item.partner_listing_stats = statsByOwner.get(item.owner_id) || item.partner_listing_stats
    }

    normalized.sort((a, b) => {
      if (b.moderation_priority !== a.moderation_priority) return b.moderation_priority - a.moderation_priority
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    })

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
    const now = new Date().toISOString()
    const nextStatus = action === 'approve' ? 'active' : 'draft'
    const patch = action === 'approve'
      ? { status: 'active', is_verified: true, published_at: now, moderation_note: null, moderation_updated_at: now, updated_at: now }
      : { status: 'draft', is_verified: false, published_at: null, moderation_note: reason, moderation_updated_at: now, updated_at: now }

    const { data: current, error: currentError } = await db
      .from('listings')
      .select('id,listing_code,status')
      .eq('id', id)
      .single()
    if (currentError) throw currentError

    const { data, error: dbError } = await db
      .from('listings')
      .update(patch)
      .eq('id', id)
      .eq('status', 'moderation')
      .select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at')
      .single()

    if (dbError) throw dbError

    const { error: historyError } = await db.from('listing_moderation_history').insert({
      listing_id: id,
      admin_user_id: admin?.user?.id || null,
      from_status: current.status,
      to_status: nextStatus,
      action,
      reason: reason || null,
      created_at: now,
    })
    if (historyError) throw historyError

    return NextResponse.json({ listing: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status: 500 })
  }
}
