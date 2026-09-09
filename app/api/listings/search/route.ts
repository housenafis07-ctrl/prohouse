import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const MAX_PAGE_SIZE = 48

function numberParam(value: string | null) {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const params = request.nextUrl.searchParams

  const page = Math.max(1, Number(params.get('page') || '1') || 1)
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('limit') || '24') || 24))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const min = numberParam(params.get('min'))
  const max = numberParam(params.get('max'))
  const rooms = numberParam(params.get('rooms'))
  const taxonomy = params.get('taxonomy')?.trim() || ''
  const listingType = params.get('listing_type')?.trim() || ''
  const propertyType = params.get('property_type')?.trim() || ''
  const city = params.get('city')?.trim() || ''
  const district = params.get('district')?.trim() || ''
  const currency = params.get('currency')?.trim() || ''
  const q = params.get('q')?.trim() || ''
  const sort = params.get('sort') || 'newest'

  let query = supabase
    .from('listings')
    .select(
      'id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,latitude,longitude,seller_type,seller_name,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,taxonomy_code',
      { count: 'estimated' },
    )
    .eq('status', 'active')

  if (taxonomy) query = query.eq('taxonomy_code', taxonomy)
  if (listingType) query = query.eq('listing_type', listingType)
  if (propertyType) query = query.eq('property_type', propertyType)
  if (city) query = query.eq('city', city)
  if (district) query = query.eq('district', district)
  if (currency) query = query.eq('currency', currency)
  if (min !== null) query = query.gte('price', min)
  if (max !== null) query = query.lte('price', max)
  if (rooms !== null) query = query.gte('rooms', rooms)
  if (params.get('owner') === 'true') query = query.eq('seller_type', 'owner')
  if (params.get('mortgage') === 'true') query = query.eq('is_mortgage_available', true)
  if (params.get('verified') === 'true') query = query.eq('is_verified', true)
  if (q) query = query.or(`title.ilike.%${q}%,title_ru.ilike.%${q}%`)

  if (sort === 'priceLow') {
    query = query.order('price', { ascending: true }).order('id', { ascending: true })
  } else if (sort === 'priceHigh') {
    query = query.order('price', { ascending: false }).order('id', { ascending: false })
  } else {
    query = query.order('published_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  }

  const { data, count, error } = await query.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const listings = data || []
  const ids = listings.map((listing) => listing.id)
  let images: { listing_id: string; image_url: string; sort_order: number | null }[] = []

  if (ids.length) {
    const { data: imageRows, error: imageError } = await supabase
      .from('listing_images')
      .select('listing_id,image_url,sort_order')
      .in('listing_id', ids)
      .order('sort_order', { ascending: true })

    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 })
    images = imageRows || []
  }

  const firstImageByListing = new Map<string, { image_url: string; sort_order: number | null }>()
  for (const image of images) {
    if (!firstImageByListing.has(image.listing_id)) {
      firstImageByListing.set(image.listing_id, {
        image_url: image.image_url,
        sort_order: image.sort_order,
      })
    }
  }

  return NextResponse.json({
    data: listings.map((listing) => ({
      ...listing,
      primary_image: firstImageByListing.get(listing.id) || null,
    })),
    pagination: {
      page,
      limit,
      total: count ?? null,
      has_next: listings.length === limit,
    },
  })
}
