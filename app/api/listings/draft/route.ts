import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const allowedStatuses = new Set(['draft', 'moderation'])
const ownershipTypes = new Set(['owner', 'power_of_attorney', 'representative'])

type DraftData = Record<string, unknown> & { attributes?: Record<string, unknown> }

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const numberOrNull = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const listingId = typeof body.listingId === 'string' ? body.listingId : null
  const step = Math.max(1, Math.min(7, Number(body.step) || 1))
  const data = (body.data && typeof body.data === 'object' ? body.data : {}) as DraftData
  const status = typeof body.status === 'string' && allowedStatuses.has(body.status) ? body.status : 'draft'
  const attributes = data.attributes && typeof data.attributes === 'object' ? data.attributes : {}
  const ownershipRaw = data.ownership_type ?? attributes.ownership_type
  const ownershipType = typeof ownershipRaw === 'string' && ownershipTypes.has(ownershipRaw) ? ownershipRaw : null
  const mortgageRaw = data.mortgage ?? attributes.mortgage
  // listings.is_mortgage_available is NOT NULL, so an omitted checkbox must
  // be stored as false rather than null.
  const isMortgageAvailable = mortgageRaw === 'true' || mortgageRaw === true

  // The listing wizard stores dynamic attributes separately. Persist the fields
  // needed by search/moderation as first-class listing columns as well.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('account_type,full_name,phone,company_name,director_full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  const accountType = profile?.account_type || 'individual'
  const sellerRole = accountType === 'individual' ? 'owner' : null
  const isIndividualOwner = accountType === 'individual' && ownershipType === 'owner'
  const sellerType = isIndividualOwner ? 'owner' : null
  const sellerName = isIndividualOwner ? text(profile?.full_name) || null : null
  const sellerPhone = isIndividualOwner ? text(profile?.phone) || user.phone || null : null

  if (status === 'moderation') {
    const { error: limitError } = await supabase.rpc('assert_individual_listing_limit', { p_user_id: user.id })
    if (limitError) {
      if (limitError.message.includes('LISTING_LIMIT_REACHED')) return NextResponse.json({ error: 'LISTING_LIMIT_REACHED', message: '3 ta bepul faol e’lon limitingiz tugagan. Qo‘shimcha e’lon uchun monetizatsiya xizmatini tanlang.' }, { status: 402 })
      return NextResponse.json({ error: limitError.message }, { status: 400 })
    }
  }

  const commonFields: Record<string, unknown> = {
    city: text(data.city) || null,
    district: text(data.district) || null,
    neighborhood: text(data.neighborhood) || null,
    address: text(data.address) || null,
    latitude: numberOrNull(data.latitude),
    longitude: numberOrNull(data.longitude),
    area_m2: numberOrNull(data.area_m2),
    rooms: numberOrNull(data.rooms),
    floor: numberOrNull(data.floor),
    floors_total: numberOrNull(data.floors_total),
    ownership_type: ownershipType,
    is_mortgage_available: isMortgageAvailable,
    seller_role: sellerRole,
    seller_type: sellerType,
    seller_name: sellerName,
    seller_phone: sellerPhone,
  }

  if (!listingId) {
    const taxonomyCode = typeof data.taxonomy_code === 'string' ? data.taxonomy_code : null
    if (!taxonomyCode) return NextResponse.json({ error: 'TAXONOMY_REQUIRED' }, { status: 400 })
    const insertData: Record<string, unknown> = {
      owner_id: user.id,
      taxonomy_code: taxonomyCode,
      title: text(data.title) || 'Qoralama e’lon',
      description: typeof data.description === 'string' ? data.description : null,
      listing_type: typeof data.listing_type === 'string' ? data.listing_type : 'sale',
      property_type: typeof data.property_type === 'string' ? data.property_type : 'apartment',
      status,
      price: Number.isFinite(Number(data.price)) ? Number(data.price) : 0,
      currency: data.currency === 'USD' ? 'USD' : 'UZS',
      draft_step: step,
      draft_data: data,
      submitted_at: status === 'moderation' ? new Date().toISOString() : null,
      ...commonFields,
    }
    const { data: created, error } = await supabase.from('listings').insert(insertData).select('id,listing_code,status,draft_step,ownership_type,seller_type,seller_role,city,district,address,seller_name,seller_phone').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ listing: created })
  }

  const updateData: Record<string, unknown> = {
    draft_step: step,
    draft_data: data,
    ...(typeof data.title === 'string' && data.title.trim() ? { title: data.title.trim() } : {}),
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
    ...(data.price !== undefined && Number.isFinite(Number(data.price)) ? { price: Number(data.price) } : {}),
    ...(data.currency === 'UZS' || data.currency === 'USD' ? { currency: data.currency } : {}),
    ...commonFields,
    ...(status === 'moderation' ? { status: 'moderation', submitted_at: new Date().toISOString() } : { status: 'draft' }),
  }
  const { data: updated, error } = await supabase.from('listings').update(updateData).eq('id', listingId).eq('owner_id', user.id).select('id,listing_code,status,draft_step,ownership_type,seller_type,seller_role,city,district,address,seller_name,seller_phone').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ listing: updated })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const url = new URL(request.url)
  const listingId = url.searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })

  const { data: listing, error: findError } = await supabase.from('listings').select('id,status').eq('id', listingId).eq('owner_id', user.id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 })
  if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
  if (!['draft', 'rejected'].includes(listing.status)) return NextResponse.json({ error: 'ONLY_DRAFT_OR_REJECTED_CAN_BE_CANCELLED' }, { status: 409 })

  const { error } = await supabase.from('listings').delete().eq('id', listingId).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, status: 'deleted' })
}
