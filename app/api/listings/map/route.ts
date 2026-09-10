import { NextRequest, NextResponse } from 'next/server'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { createClient } from '@/utils/supabase/server'

const MAX_MARKERS = 500

function numberParam(value: string | null) {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function escapePostgrestFilterValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/([,()])/g, '\\$1')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const params = request.nextUrl.searchParams
  const min = numberParam(params.get('min'))
  const max = numberParam(params.get('max'))
  const rooms = numberParam(params.get('rooms'))
  const listingType = params.get('listing_type')?.trim() || ''
  const propertyType = params.get('property_type')?.trim() || ''
  const city = params.get('city')?.trim() || ''
  const district = params.get('district')?.trim() || ''
  const region = params.get('region')?.trim() || ''
  const currency = params.get('currency')?.trim() || ''
  const q = params.get('q')?.trim() || ''
  const taxonomy = params.get('taxonomy')?.trim() || ''
  const tab = params.get('tab') || ''
  const south = numberParam(params.get('south'))
  const north = numberParam(params.get('north'))
  const west = numberParam(params.get('west'))
  const east = numberParam(params.get('east'))

  let query = supabase
    .from('listings')
    .select('id,title,price,currency,listing_type,property_type,city,district,latitude,longitude,is_trusted_seller', { count: 'estimated' })
    .eq('status', 'active')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

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
  if (q) {
    const safeQ = escapePostgrestFilterValue(q)
    query = query.or(`title.ilike.%${safeQ}%,title_ru.ilike.%${safeQ}%`)
  }

  if (south !== null && north !== null) query = query.gte('latitude', south).lte('latitude', north)
  if (west !== null && east !== null) query = query.gte('longitude', west).lte('longitude', east)

  query = query.order('is_featured', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false }).range(0, MAX_MARKERS)
  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as Array<Record<string, unknown>>
  const truncated = rows.length > MAX_MARKERS
  const markers = (truncated ? rows.slice(0, MAX_MARKERS) : rows).map((item) => ({
    ...item,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  }))

  return NextResponse.json({
    data: markers,
    pagination: {
      total: count ?? null,
      limit: MAX_MARKERS,
      truncated,
    },
  })
}
