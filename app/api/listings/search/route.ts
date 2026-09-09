import { NextRequest, NextResponse } from 'next/server'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { getListingCardImageUrl } from '@/lib/listing-image'
import { createClient } from '@/utils/supabase/server'

const MAX_PAGE_SIZE = 48

type Cursor = {
  sort: 'newest' | 'priceLow' | 'priceHigh'
  id: string
  published_at?: string | null
  price?: number | null
}

function numberParam(value: string | null) {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function decodeCursor(value: string | null, sort: Cursor['sort']): Cursor | null {
  if (!value) return null
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Cursor
    if (!parsed || parsed.sort !== sort || typeof parsed.id !== 'string') return null
    if (sort === 'newest') {
      if (parsed.published_at !== null && typeof parsed.published_at !== 'string') return null
    } else if (typeof parsed.price !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const params = request.nextUrl.searchParams
  const page = Math.max(1, Number(params.get('page') || '1') || 1)
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('limit') || '24') || 24))
  const sort = (params.get('sort') || 'newest') as Cursor['sort']
  const cursor = decodeCursor(params.get('cursor'), sort)

  const min = numberParam(params.get('min'))
  const max = numberParam(params.get('max'))
  const rooms = numberParam(params.get('rooms'))
  const taxonomy = params.get('taxonomy')?.trim() || ''
  const listingType = params.get('listing_type')?.trim() || ''
  const propertyType = params.get('property_type')?.trim() || ''
  const city = params.get('city')?.trim() || ''
  const district = params.get('district')?.trim() || ''
  const region = params.get('region')?.trim() || ''
  const currency = params.get('currency')?.trim() || ''
  const q = params.get('q')?.trim() || ''
  const tab = params.get('tab') || ''

  if (!['newest', 'priceLow', 'priceHigh'].includes(sort)) {
    return NextResponse.json({ error: 'Noto‘g‘ri saralash parametri.' }, { status: 400 })
  }
  if (params.get('cursor') && !cursor) {
    return NextResponse.json({ error: 'Noto‘g‘ri yoki eskirgan pagination cursor.' }, { status: 400 })
  }

  let query = supabase
    .from('listings')
    .select('id,title,title_ru,listing_type,property_type,price,currency,area_m2,rooms,floor,floors_total,district,city,latitude,longitude,seller_type,seller_name,is_mortgage_available,is_verified,is_trusted_seller,is_featured,published_at,taxonomy_code', { count: 'estimated' })
    .eq('status', 'active')

  if (taxonomy) query = query.eq('taxonomy_code', taxonomy)
  if (listingType) query = query.eq('listing_type', listingType)
  if (propertyType) query = query.eq('property_type', propertyType)
  if (city) query = query.eq('city', city)
  if (district) query = query.eq('district', district)
  if (currency) query = query.eq('currency', currency)
  if (region) {
    const regionData = UZBEKISTAN_LOCATIONS.find((item) => item.name === region)
    if (region === 'Toshkent shahri') query = query.eq('city', 'Toshkent')
    else if (regionData?.districts.length) query = query.in('district', regionData.districts)
  }
  if (!listingType && tab === 'sale') query = query.or('listing_type.eq.sale,listing_type.eq.new_building')
  else if (!listingType && tab === 'rent') query = query.eq('listing_type', 'rent')
  else if (!listingType && tab === 'daily') query = query.eq('listing_type', 'daily')
  if (min !== null) query = query.gte('price', min)
  if (max !== null) query = query.lte('price', max)
  if (rooms !== null) query = query.gte('rooms', rooms)
  if (params.get('owner') === 'true') query = query.eq('seller_type', 'owner')
  if (params.get('mortgage') === 'true') query = query.eq('is_mortgage_available', true)
  if (params.get('verified') === 'true') query = query.eq('is_verified', true)
  if (q) query = query.or(`title.ilike.%${q}%,title_ru.ilike.%${q}%`)

  if (cursor) {
    if (sort === 'newest') {
      if (cursor.published_at === null) {
        query = query.or(`published_at.is.null,and(published_at.is.null,id.lt.${cursor.id})`)
      } else {
        query = query.or(`published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id}),published_at.is.null`)
      }
    } else if (sort === 'priceLow') {
      query = query.or(`price.gt.${cursor.price},and(price.eq.${cursor.price},id.gt.${cursor.id})`)
    } else {
      query = query.or(`price.lt.${cursor.price},and(price.eq.${cursor.price},id.lt.${cursor.id})`)
    }
  }

  if (sort === 'priceLow') query = query.order('price', { ascending: true }).order('id', { ascending: true })
  else if (sort === 'priceHigh') query = query.order('price', { ascending: false }).order('id', { ascending: false })
  else query = query.order('published_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })

  // Cursor mode never uses OFFSET. The legacy page parameter remains available
  // for older clients so this rollout cannot break existing consumers.
  const useCursor = Boolean(params.get('cursor')) || !params.has('page')
  const { data, count, error } = useCursor
    ? await query.range(0, limit)
    : await query.range((page - 1) * limit, (page - 1) * limit + limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pageRows = data || []
  const hasNext = pageRows.length > limit
  const listings = hasNext ? pageRows.slice(0, limit) : pageRows
  const ids = listings.map((listing) => listing.id)

  // Search cards only need the primary image. Never load every image for the
  // current page: a 24-card page could otherwise fetch up to 240+ image rows.
  let images: { listing_id: string; image_url: string; sort_order: number | null }[] = []
  if (ids.length) {
    const { data: imageRows, error: imageError } = await supabase
      .from('listing_images')
      .select('listing_id,image_url,sort_order')
      .in('listing_id', ids)
      .eq('sort_order', 0)
      .order('sort_order', { ascending: true })
    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 })
    images = imageRows || []
  }

  const firstImageByListing = new Map<string, { image_url: string; sort_order: number | null }>()
  for (const image of images) {
    if (!firstImageByListing.has(image.listing_id)) {
      firstImageByListing.set(image.listing_id, {
        image_url: getListingCardImageUrl(image.image_url),
        sort_order: image.sort_order,
      })
    }
  }

  const last = listings[listings.length - 1]
  const nextCursor = hasNext && last
    ? encodeCursor(sort === 'newest'
      ? { sort, id: last.id, published_at: last.published_at }
      : { sort, id: last.id, price: last.price })
    : null

  return NextResponse.json({
    data: listings.map((listing) => ({ ...listing, primary_image: firstImageByListing.get(listing.id) || null })),
    pagination: {
      page: useCursor ? undefined : page,
      limit,
      total: count ?? null,
      has_next: hasNext,
      next_cursor: nextCursor,
      mode: useCursor ? 'cursor' : 'offset',
    },
  })
}
