import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const allowedStatuses = new Set(['draft', 'moderation'])
const ownershipTypes = new Set(['owner', 'power_of_attorney', 'representative'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const listingId = typeof body.listingId === 'string' ? body.listingId : null
  const step = Math.max(1, Math.min(7, Number(body.step) || 1))
  const data = body.data && typeof body.data === 'object' ? body.data : {}
  const status = typeof body.status === 'string' && allowedStatuses.has(body.status) ? body.status : 'draft'
  const ownershipType = typeof data.ownership_type === 'string' && ownershipTypes.has(data.ownership_type)
    ? data.ownership_type
    : null

  let sellerRole: string | null = null
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  if (profile?.account_type === 'individual') sellerRole = 'owner'

  if (status === 'moderation') {
    const { error: limitError } = await supabase.rpc('assert_individual_listing_limit', { p_user_id: user.id })
    if (limitError) {
      if (limitError.message.includes('LISTING_LIMIT_REACHED')) {
        return NextResponse.json({
          error: 'LISTING_LIMIT_REACHED',
          message: '3 ta bepul faol e’lon limitingiz tugagan. Qo‘shimcha e’lon uchun monetizatsiya xizmatini tanlang.'
        }, { status: 402 })
      }
      return NextResponse.json({ error: limitError.message }, { status: 400 })
    }
  }

  const sellerType = ownershipType === 'owner' ? 'owner' : null

  if (!listingId) {
    const taxonomyCode = typeof data.taxonomy_code === 'string' ? data.taxonomy_code : null
    if (!taxonomyCode) return NextResponse.json({ error: 'TAXONOMY_REQUIRED' }, { status: 400 })

    const insertData: Record<string, unknown> = {
      owner_id: user.id,
      taxonomy_code: taxonomyCode,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Qoralama e’lon',
      description: typeof data.description === 'string' ? data.description : null,
      listing_type: typeof data.listing_type === 'string' ? data.listing_type : 'sale',
      property_type: typeof data.property_type === 'string' ? data.property_type : 'apartment',
      status,
      price: Number.isFinite(Number(data.price)) ? Number(data.price) : 0,
      currency: data.currency === 'USD' ? 'USD' : 'UZS',
      draft_step: step,
      draft_data: data,
      submitted_at: status === 'moderation' ? new Date().toISOString() : null,
    }
    if (sellerRole) insertData.seller_role = sellerRole
    if (sellerType) insertData.seller_type = sellerType
    if (ownershipType) insertData.ownership_type = ownershipType

    const { data: created, error } = await supabase
      .from('listings')
      .insert(insertData)
      .select('id,listing_code,status,draft_step,ownership_type,seller_type,seller_role')
      .single()
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
    ...(status === 'moderation' ? { status: 'moderation', submitted_at: new Date().toISOString() } : { status: 'draft' }),
  }
  if (sellerRole) updateData.seller_role = sellerRole
  if (ownershipType) updateData.ownership_type = ownershipType
  if (sellerType) updateData.seller_type = sellerType

  const { data: updated, error } = await supabase
    .from('listings')
    .update(updateData)
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .select('id,listing_code,status,draft_step,ownership_type,seller_type,seller_role')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ listing: updated })
}
