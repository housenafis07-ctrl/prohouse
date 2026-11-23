import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'PARTNER_ID_REQUIRED' }, { status: 400 })

  const db = serviceClient()
  const { data: partner, error: partnerError } = await db
    .from('partner_profiles')
    .select('id,user_id,partner_type,legal_form,display_name,company_name,description,logo_url,website,service_regions,verification_status,trusted_partner_status')
    .eq('id', id)
    .maybeSingle()

  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })

  const { data: entitlement, error: entitlementError } = await db
    .from('monetization_entitlements')
    .select('id,product_code,status,starts_at,ends_at')
    .eq('user_id', partner.user_id)
    .eq('product_code', 'partner_business')
    .eq('status', 'active')
    .lte('starts_at', new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order('ends_at', { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (entitlementError) return NextResponse.json({ error: entitlementError.message }, { status: 500 })
  if (!entitlement) return NextResponse.json({ error: 'COMPANY_PROFILE_REQUIRES_BUSINESS' }, { status: 403 })

  const { data: listings, error: listingsError } = await db
    .from('listings')
    .select('id,title,title_ru,price,currency,city,district,property_type,listing_type,primary_image_url,is_verified,is_trusted_seller,published_at')
    .eq('owner_id', partner.user_id)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(24)

  if (listingsError) return NextResponse.json({ error: listingsError.message }, { status: 500 })

  return NextResponse.json({
    partner: {
      ...partner,
      is_trusted_partner: partner.trusted_partner_status === 'verified',
    },
    listings: listings || [],
    plan: 'partner_business',
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
