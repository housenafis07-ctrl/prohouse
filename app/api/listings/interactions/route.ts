import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const eventTypes = new Set(['view','favorite','unfavorite','phone_click','chat_start','share','mortgage_click','map_open'])
const VIEW_DEDUPE_HOURS = 24

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.listingId !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const listingId = body.listingId
  const action = typeof body.action === 'string' ? body.action : ''
  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim().slice(0, 128) : null

  const { data: listing } = await supabase.from('listings').select('id,status,owner_id').eq('id', listingId).maybeSingle()
  if (!listing || (listing.status !== 'active' && listing.owner_id !== user?.id)) {
    return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
  }

  if (action === 'view') {
    if (user?.id === listing.owner_id) return NextResponse.json({ ok: true, recorded: false })
    // A page refresh/reopen from the same browser must not inflate the view count.
    // Authenticated users fall back to user_id when a session id is unavailable.
    const since = new Date(Date.now() - VIEW_DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
    let duplicateQuery = supabase
      .from('listing_events')
      .select('id')
      .eq('listing_id', listingId)
      .eq('event_type', 'view')
      .gte('created_at', since)
      .limit(1)

    if (sessionId) duplicateQuery = duplicateQuery.eq('session_id', sessionId)
    else if (user?.id) duplicateQuery = duplicateQuery.eq('user_id', user.id)
    else return NextResponse.json({ ok: true, recorded: false })

    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle()
    if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 400 })
    if (duplicate) return NextResponse.json({ ok: true, recorded: false })
  }

  if (action === 'favorite' || action === 'unfavorite') {
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    if (action === 'favorite') {
      const { error } = await supabase.from('listing_favorites').upsert({ user_id: user.id, listing_id: listingId }, { onConflict: 'user_id,listing_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      const { error } = await supabase.from('listing_favorites').delete().eq('user_id', user.id).eq('listing_id', listingId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    await supabase.from('listing_events').insert({ listing_id: listingId, user_id: user.id, session_id: sessionId, event_type: action, metadata: {} })
    return NextResponse.json({ ok: true, favorite: action === 'favorite' })
  }

  if (!eventTypes.has(action)) return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  const { error } = await supabase.from('listing_events').insert({
    listing_id: listingId,
    user_id: user?.id ?? null,
    session_id: sessionId,
    event_type: action,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, recorded: true })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const searchParams = new URL(request.url).searchParams
  const listingId = searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })

  const { data: listing } = await supabase.from('listings').select('id,owner_id').eq('id', listingId).maybeSingle()
  if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })

  if (searchParams.get('stats') === '1') {
    if (listing.owner_id !== user.id) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    const { data: events, error } = await supabase
      .from('listing_events')
      .select('event_type,user_id,session_id,created_at')
      .eq('listing_id', listingId)
      .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const rows = events || []
    const uniqueKeys = new Set<string>()
    let views = 0
    let shares = 0
    let phoneClicks = 0
    let chatStarts = 0
    let todayViews = 0
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    for (const event of rows) {
      if (event.event_type === 'view') {
        const key = event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`)
        uniqueKeys.add(key)
        views += 1
        if (new Date(event.created_at) >= todayStart) todayViews += 1
      } else if (event.event_type === 'share') shares += 1
      else if (event.event_type === 'phone_click') phoneClicks += 1
      else if (event.event_type === 'chat_start') chatStarts += 1
    }

    return NextResponse.json({
      views,
      uniqueViews: uniqueKeys.size,
      todayViews,
      shares,
      phoneClicks,
      chatStarts,
    })
  }

  const { data } = await supabase.from('listing_favorites').select('listing_id').eq('user_id', user.id).eq('listing_id', listingId).maybeSingle()
  return NextResponse.json({ favorite: Boolean(data) })
}
