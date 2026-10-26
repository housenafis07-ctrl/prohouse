import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const serviceCode = (value: string | null | undefined) => Boolean(value && (value === 'services' || value.startsWith('services_')))

async function getReviewContext(db: Awaited<ReturnType<typeof createClient>>, listingId: string, userId?: string) {
  const { data: listing, error } = await db
    .from('listings')
    .select('id,owner_id,taxonomy_code,listing_type,property_type')
    .eq('id', listingId)
    .maybeSingle()
  if (error) throw error
  if (!listing) return null

  const { data: category } = await db
    .from('listing_categories')
    .select('entity_type')
    .eq('code', listing.taxonomy_code || '')
    .maybeSingle()

  const isService =
    listing.listing_type === 'service' ||
    listing.property_type === 'service' ||
    category?.entity_type === 'service' ||
    serviceCode(listing.taxonomy_code)
  const isDacha = listing.taxonomy_code === 'rent_dacha'
  let eligible = false

  if (userId && userId !== listing.owner_id) {
    if (isDacha) {
      const today = new Date().toISOString().slice(0, 10)
      const { data: booking } = await db
        .from('rental_bookings')
        .select('id')
        .eq('listing_id', listingId)
        .eq('guest_id', userId)
        .eq('payment_status', 'paid')
        .eq('status', 'confirmed')
        .lt('check_out', today)
        .limit(1)
        .maybeSingle()
      eligible = Boolean(booking)
    } else if (isService) {
      const { data: serviceOrder } = await db
        .from('service_orders')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', userId)
        .eq('status', 'completed')
        .limit(1)
        .maybeSingle()
      eligible = Boolean(serviceOrder)
    }
  }

  return { listing, isService, isDacha, eligible }
}

export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get('listingId')?.trim()
  if (!listingId) return NextResponse.json({ error: 'listingId kerak.' }, { status: 400 })

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  const context = await getReviewContext(db, listingId, user?.id)
  if (!context) return NextResponse.json({ error: 'E’lon topilmadi.' }, { status: 404 })
  if (!context.isService && !context.isDacha) {
    return NextResponse.json({ reviewable: false, eligible: false, reviews: [], average: null, count: 0 })
  }

  const { data: reviews, error } = await db
    .from('listing_reviews')
    .select('id,rating,body,created_at,author_id')
    .eq('listing_id', listingId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = reviews || []
  const average = rows.length ? Math.round((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / rows.length) * 10) / 10 : null
  let mine: { id: string; rating: number; body: string | null } | null = null

  if (user) {
    const { data: mineRow } = await db
      .from('listing_reviews')
      .select('id,rating,body')
      .eq('listing_id', listingId)
      .eq('author_id', user.id)
      .eq('status', 'published')
      .maybeSingle()
    if (mineRow) mine = mineRow
  }

  return NextResponse.json({
    reviewable: true,
    eligible: context.eligible && !mine,
    average,
    count: rows.length,
    reviews: rows.map(({ author_id: _authorId, ...row }) => row),
    mine,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Baholash uchun tizimga kiring.' }, { status: 401 })

  let body: { listingId?: string; rating?: number; review?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Noto‘g‘ri so‘rov.' }, { status: 400 }) }

  const listingId = String(body.listingId || '').trim()
  const rating = Number(body.rating)
  const review = String(body.review || '').trim()
  if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Bahoni 1 dan 5 gacha tanlang.' }, { status: 400 })
  if (review.length > 1000) return NextResponse.json({ error: 'Otziv 1000 belgidan oshmasin.' }, { status: 400 })

  const context = await getReviewContext(db, listingId, user.id)
  if (!context || (!context.isService && !context.isDacha)) return NextResponse.json({ error: 'Bu turdagi e’lonni baholash mumkin emas.' }, { status: 400 })
  if (!context.eligible) return NextResponse.json({ error: context.isDacha ? 'Baholash uchun avval bronni yakunlang.' : 'Baholash uchun xizmat ikki tomon tomonidan yakunlangan bo‘lishi kerak.' }, { status: 403 })

  const { data: existing } = await db
    .from('listing_reviews')
    .select('id')
    .eq('listing_id', listingId)
    .eq('author_id', user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Siz bu e’lonni allaqachon baholagansiz.' }, { status: 409 })

  const { data: created, error } = await db
    .from('listing_reviews')
    .insert({ listing_id: listingId, reviewed_user_id: context.listing.owner_id, author_id: user.id, rating, body: review || null, status: 'published' })
    .select('id,rating,body,created_at')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Siz bu e’lonni allaqachon baholagansiz.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ review: created }, { status: 201 })
}
