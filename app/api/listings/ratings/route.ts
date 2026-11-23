import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const serviceCode = (value: string | null | undefined) => Boolean(value && (value === 'services' || value.startsWith('services_')))

export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 48)
  if (!ids.length) return NextResponse.json({ data: {} })

  const supabase = await createClient()
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id,taxonomy_code,listing_type,property_type')
    .in('id', ids)

  if (listingsError) return NextResponse.json({ error: listingsError.message }, { status: 500 })

  const taxonomyCodes = [...new Set((listings || []).map((listing) => listing.taxonomy_code).filter(Boolean))]
  const { data: categories, error: categoriesError } = taxonomyCodes.length
    ? await supabase.from('listing_categories').select('code,entity_type').in('code', taxonomyCodes)
    : { data: [], error: null }

  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })

  const categoryType = new Map((categories || []).map((category) => [category.code, category.entity_type]))
  const reviewableIds = new Set(
    (listings || [])
      .filter((listing) => {
        const isService = listing.listing_type === 'service' || listing.property_type === 'service' || categoryType.get(listing.taxonomy_code || '') === 'service' || serviceCode(listing.taxonomy_code)
        const isDacha = listing.taxonomy_code === 'rent_dacha'
        return isService || isDacha
      })
      .map((listing) => listing.id)
  )

  if (!reviewableIds.size) return NextResponse.json({ data: {} })

  const { data, error } = await supabase
    .from('listing_reviews')
    .select('listing_id,rating')
    .in('listing_id', [...reviewableIds])
    .eq('status', 'published')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const grouped: Record<string, { sum: number; count: number }> = {}
  for (const row of data || []) {
    if (!row.listing_id) continue
    const bucket = grouped[row.listing_id] || { sum: 0, count: 0 }
    bucket.sum += Number(row.rating) || 0
    bucket.count += 1
    grouped[row.listing_id] = bucket
  }

  const result: Record<string, { average: number; count: number }> = {}
  for (const [id, bucket] of Object.entries(grouped)) {
    if (!bucket.count) continue
    result[id] = { average: Math.round((bucket.sum / bucket.count) * 10) / 10, count: bucket.count }
  }

  return NextResponse.json({ data: result }, { headers: { 'Cache-Control': 'no-store' } })
}
