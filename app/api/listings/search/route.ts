import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type AttributeFilter = {
  code: string
  value?: string
  min?: number
  max?: number
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const params = request.nextUrl.searchParams
  const taxonomy = params.get('taxonomy')
  const filters: AttributeFilter[] = params.get('attributes') ? JSON.parse(params.get('attributes')!) : []

  let query = supabase
    .from('listings')
    .select('*, listing_images(image_url,sort_order)')
    .eq('status', 'active')

  if (taxonomy) query = query.eq('taxonomy_code', taxonomy)
  if (params.get('listing_type')) query = query.eq('listing_type', params.get('listing_type')!)
  if (params.get('property_type')) query = query.eq('property_type', params.get('property_type')!)
  if (params.get('currency')) query = query.eq('currency', params.get('currency')!)
  if (params.get('verified') === 'true') query = query.eq('is_verified', true)
  if (params.get('mortgage') === 'true') query = query.eq('is_mortgage_available', true)
  if (params.get('owner') === 'true') query = query.eq('seller_type', 'owner')

  const { data: listings, error } = await query.order('published_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!filters.length || !listings?.length) return NextResponse.json({ listings: listings || [] })

  const ids = listings.map((x) => x.id)
  const { data: values, error: valuesError } = await supabase
    .from('listing_attribute_values')
    .select('listing_id,value_jsonb,category_attributes!inner(code,data_type)')
    .in('listing_id', ids)

  if (valuesError) return NextResponse.json({ error: valuesError.message }, { status: 500 })

  const byListing = new Map<string, { code: string; value: unknown }[]>()
  for (const row of values || []) {
    const attribute = Array.isArray(row.category_attributes) ? row.category_attributes[0] : row.category_attributes
    if (!attribute) continue
    const list = byListing.get(row.listing_id) || []
    list.push({ code: attribute.code, value: row.value_jsonb })
    byListing.set(row.listing_id, list)
  }

  const matches = (listingId: string) => {
    const valuesForListing = byListing.get(listingId) || []
    return filters.every((filter) => {
      const row = valuesForListing.find((x) => x.code === filter.code)
      if (!row) return false
      const raw = typeof row.value === 'string' ? row.value : String(row.value ?? '')
      if (filter.value != null && raw !== filter.value) return false
      const number = Number(raw)
      if (filter.min != null && (!Number.isFinite(number) || number < filter.min)) return false
      if (filter.max != null && (!Number.isFinite(number) || number > filter.max)) return false
      return true
    })
  }

  return NextResponse.json({ listings: listings.filter((x) => matches(x.id)) })
}
