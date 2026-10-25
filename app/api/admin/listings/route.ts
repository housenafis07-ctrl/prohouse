import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

type AnyRow = Record<string, any>

const select = [
  'id','listing_code','title','title_ru','description','listing_type','property_type','status','price','currency',
  'area_m2','rooms','floor','floors_total','city','district','neighborhood','address','latitude','longitude',
  'seller_type','seller_name','seller_phone','is_mortgage_available','is_verified','is_trusted_seller','is_featured',
  'published_at','created_at','updated_at','taxonomy_code','moderation_note','moderation_updated_at','owner_id',
  'ownership_type','draft_data','views_count','accommodation_type','max_guests','sold_or_rented_at',
  'partner_listing_taxonomy(name_uz,name_ru,section_code,parent_code,is_mortgage_filter,is_new_construction_filter)',
  'listing_images(id,image_url,sort_order,storage_path)',
  'listing_media(id,media_type,provider,status,processed_storage_path,playback_url,thumbnail_storage_path,mime_type,original_mime_type,duration_seconds,width,height,size_bytes,sort_order)',
].join(',')

export async function GET() {
  const { error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const { data, error: listingsError } = await db.from('listings').select(select).eq('status', 'moderation').order('updated_at', { ascending: true })
    if (listingsError) throw listingsError

    const listings = (data ?? []) as AnyRow[]
    const ownerIds = [...new Set(listings.map(x => x.owner_id).filter(Boolean))]
    const listingIds = listings.map(x => x.id).filter(Boolean)

    const profiles = new Map<string, AnyRow>()
    const partners = new Map<string, AnyRow>()
    const documents = new Map<string, AnyRow[]>()
    const history = new Map<string, AnyRow[]>()
    const stats = new Map<string, AnyRow>()

    if (ownerIds.length) {
      const { data: profileRows } = await db.from('profiles').select('id,profile_code,full_name,phone,account_type,company_name,inn,created_at,updated_at').in('id', ownerIds)
      for (const row of profileRows ?? []) profiles.set(row.id, row)

      const { data: partnerRows } = await db.from('partner_profiles').select('id,user_id,partner_type,legal_form,display_name,company_name,verification_status,trusted_partner_status,trusted_partner_rejection_reason,trusted_partner_reviewed_at,updated_at').in('user_id', ownerIds)
      for (const row of partnerRows ?? []) partners.set(row.user_id, row)

      const { data: documentRows } = await db.from('partner_verification_documents').select('id,user_id,partner_profile_id,document_type,file_name,mime_type,size_bytes,status,rejection_reason,created_at,reviewed_at').in('user_id', ownerIds).order('created_at', { ascending: false })
      for (const row of documentRows ?? []) documents.set(row.user_id, [...(documents.get(row.user_id) ?? []), row])

      const { data: ownerRows } = await db.from('listings').select('owner_id,status').in('owner_id', ownerIds)
      for (const row of ownerRows ?? []) {
        const s = stats.get(row.owner_id) ?? { total:0,draft:0,moderation:0,active:0,rejected:0,sold:0,rented:0 }
        s.total += 1
        if (Object.prototype.hasOwnProperty.call(s, row.status)) s[row.status] += 1
        stats.set(row.owner_id, s)
      }
    }

    if (listingIds.length) {
      const { data: historyRows } = await db.from('listing_moderation_history').select('id,listing_id,admin_user_id,from_status,to_status,action,reason,created_at').in('listing_id', listingIds).order('created_at', { ascending: false })
      const adminIds = [...new Set((historyRows ?? []).map(x => x.admin_user_id).filter(Boolean))]
      const adminProfiles = new Map<string, AnyRow>()
      if (adminIds.length) {
        const { data: adminRows } = await db.from('profiles').select('id,full_name,profile_code,phone').in('id', adminIds)
        for (const row of adminRows ?? []) adminProfiles.set(row.id, row)
      }
      for (const row of historyRows ?? []) {
        const list = history.get(row.listing_id) ?? []
        list.push({ ...row, admin: row.admin_user_id ? adminProfiles.get(row.admin_user_id) ?? null : null })
        history.set(row.listing_id, list)
      }
    }

    const normalized = listings.map(item => {
      const draft = item.draft_data && typeof item.draft_data === 'object' ? item.draft_data : {}
      const attributes = draft.attributes && typeof draft.attributes === 'object' ? draft.attributes : {}
      const profile = profiles.get(item.owner_id) ?? null
      const partner = partners.get(item.owner_id) ?? null
      const ownershipType = item.ownership_type || draft.ownership_type || attributes.ownership_type || null
      const isOwner = ownershipType === 'owner'
      const media = Array.isArray(item.listing_media) ? item.listing_media : []
      const video = media.filter((x: AnyRow) => x.media_type === 'video' && x.status !== 'deleted').sort((a: AnyRow,b: AnyRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ?? null
      return {
        ...item,
        city: item.city || draft.city || null,
        district: item.district || draft.district || null,
        neighborhood: item.neighborhood || draft.neighborhood || null,
        address: item.address || draft.address || null,
        latitude: item.latitude ?? (Number.isFinite(Number(draft.latitude)) ? Number(draft.latitude) : null),
        longitude: item.longitude ?? (Number.isFinite(Number(draft.longitude)) ? Number(draft.longitude) : null),
        ownership_type: ownershipType,
        seller_type: item.seller_type || (isOwner ? 'owner' : null),
        seller_name: item.seller_name || (isOwner ? profile?.full_name || null : null),
        seller_phone: item.seller_phone || (isOwner ? profile?.phone || null : null),
        is_mortgage_available: item.is_mortgage_available ?? (attributes.mortgage === 'true' ? true : attributes.mortgage === 'false' ? false : null),
        partner_id: profile?.profile_code || partner?.id || item.owner_id,
        partner_auth_id: item.owner_id,
        partner_profile: profile ? { profile_code:profile.profile_code,full_name:profile.full_name,phone:profile.phone,account_type:profile.account_type,company_name:profile.company_name,inn:profile.inn,created_at:profile.created_at,updated_at:profile.updated_at } : null,
        partner_business_profile: partner ? { id:partner.id,partner_type:partner.partner_type,legal_form:partner.legal_form,display_name:partner.display_name,company_name:partner.company_name,verification_status:partner.verification_status,trusted_partner_status:partner.trusted_partner_status,trusted_partner_rejection_reason:partner.trusted_partner_rejection_reason,trusted_partner_reviewed_at:partner.trusted_partner_reviewed_at,updated_at:partner.updated_at } : null,
        partner_listing_stats: stats.get(item.owner_id) ?? { total:0,draft:0,moderation:0,active:0,rejected:0,sold:0,rented:0 },
        verification_documents: documents.get(item.owner_id) ?? [],
        moderation_history: history.get(item.id) ?? [],
        listing_video: video,
      }
    })

    return NextResponse.json({ listings: normalized })
  } catch (e) {
    console.error('[admin/listings] moderation queue failed', e)
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
    if (!id || !action) return NextResponse.json({ error:'E’lon va amal ko‘rsatilishi kerak.' }, { status:400 })
    if (action === 'reject' && !reason) return NextResponse.json({ error:'Rad etish sababini kiriting.' }, { status:400 })

    const db = serviceClient()
    const now = new Date().toISOString()
    const nextStatus = action === 'approve' ? 'active' : 'draft'
    const patch = action === 'approve'
      ? { status:'active',is_verified:true,published_at:now,moderation_note:null,moderation_updated_at:now,updated_at:now }
      : { status:'draft',is_verified:false,published_at:null,moderation_note:reason,moderation_updated_at:now,updated_at:now }

    const { data: current, error: currentError } = await db.from('listings').select('id,listing_code,status').eq('id',id).single()
    if (currentError) throw currentError
    if (current.status !== 'moderation') return NextResponse.json({ error:'E’lon endi moderatsiya navbatida emas.' }, { status:409 })

    const { data, error: updateError } = await db.from('listings').update(patch).eq('id',id).eq('status','moderation').select('id,listing_code,status,moderation_note,moderation_updated_at,updated_at').single()
    if (updateError) throw updateError

    const { error: historyError } = await db.from('listing_moderation_history').insert({ listing_id:id,admin_user_id:admin?.user?.id||null,from_status:current.status,to_status:nextStatus,action,reason:reason||null,created_at:now })
    if (historyError) throw historyError

    return NextResponse.json({ listing:data })
  } catch (e) {
    console.error('[admin/listings] moderation action failed', e)
    return NextResponse.json({ error:e instanceof Error ? e.message : 'Moderatsiya amalini bajarib bo‘lmadi' }, { status:500 })
  }
}
