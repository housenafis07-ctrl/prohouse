import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })

  const admin = serviceClient()
  const { data: events, error } = await admin
    .from('listing_events')
    .select('listing_id,event_type,user_id,session_id,created_at')
    .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const rows = events || []
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const byListing = new Map<string, { views: number; uniqueKeys: Set<string>; todayViews: number; shares: number; phoneClicks: number; chatStarts: number }>()

  for (const event of rows) {
    const item = byListing.get(event.listing_id) || { views: 0, uniqueKeys: new Set<string>(), todayViews: 0, shares: 0, phoneClicks: 0, chatStarts: 0 }
    if (event.event_type === 'view') {
      item.views += 1
      item.uniqueKeys.add(event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`))
      if (new Date(event.created_at) >= todayStart) item.todayViews += 1
    } else if (event.event_type === 'share') item.shares += 1
    else if (event.event_type === 'phone_click') item.phoneClicks += 1
    else if (event.event_type === 'chat_start') item.chatStarts += 1
    byListing.set(event.listing_id, item)
  }

  const listingIds = Array.from(byListing.keys())
  const { data: listings, error: listingError } = listingIds.length
    ? await admin.from('listings').select('id,listing_code,title,title_ru,status,city,district,owner_id').in('id', listingIds)
    : { data: [], error: null }

  if (listingError) return NextResponse.json({ error: listingError.message }, { status: 400 })

  const listingMap = new Map((listings || []).map(listing => [listing.id, listing]))
  const topListings = listingIds.map(id => {
    const stats = byListing.get(id)!
    const listing = listingMap.get(id)
    return {
      listingId: id,
      listingCode: listing?.listing_code || null,
      title: listing?.title || '—',
      titleRu: listing?.title_ru || null,
      status: listing?.status || null,
      city: listing?.city || null,
      district: listing?.district || null,
      ownerId: listing?.owner_id || null,
      views: stats.views,
      uniqueViews: stats.uniqueKeys.size,
      todayViews: stats.todayViews,
      shares: stats.shares,
      phoneClicks: stats.phoneClicks,
      chatStarts: stats.chatStarts,
    }
  }).sort((a, b) => b.views - a.views).slice(0, 50)

  const totals = topListings.reduce((sum, item) => ({
    views: sum.views + item.views,
    uniqueViews: sum.uniqueViews + item.uniqueViews,
    todayViews: sum.todayViews + item.todayViews,
    shares: sum.shares + item.shares,
    phoneClicks: sum.phoneClicks + item.phoneClicks,
    chatStarts: sum.chatStarts + item.chatStarts,
  }), { views: 0, uniqueViews: 0, todayViews: 0, shares: 0, phoneClicks: 0, chatStarts: 0 })

  return NextResponse.json({ totals, topListings })
}
