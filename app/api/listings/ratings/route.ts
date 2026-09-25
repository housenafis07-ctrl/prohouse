import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 48)
  if (!ids.length) return NextResponse.json({ data: {} })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listing_reviews')
    .select('listing_id,rating')
    .in('listing_id', ids)
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
    // listing_reviews uses a 1–5 scale; the rental UI presents the score on a 10-point scale.
    result[id] = { average: Math.round(((bucket.sum / bucket.count) * 2) * 10) / 10, count: bucket.count }
  }

  return NextResponse.json({ data: result })
}
