import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const eventTypes = new Set(['view','favorite','unfavorite','phone_click','chat_start','share','mortgage_click','map_open'])
const VIEW_DEDUPE_HOURS = 24

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const accountUserId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  const effectiveUserId = accountUserId || user?.id || null
  const admin = serviceClient()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.listingId !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const listingId = body.listingId
  const action = typeof body.action === 'string' ? body.action : ''
  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim().slice(0, 128) : null

  const { data: listing } = await admin.from('listings').select('id,status,owner_id').eq('id', listingId).maybeSingle()
  if (!listing || (listing.status !== 'active' && listing.owner_id !== effectiveUserId)) {
    return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
  }

  if (action === 'view') {
    if (effectiveUserId === listing.owner_id) return NextResponse.json({ ok: true, recorded: false })
    // A page refresh/reopen from the same browser must not inflate the view count.
    // Authenticated users fall back to user_id when a session id is unavailable.
    const since = new Date(Date.now() - VIEW_DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
    let duplicateQuery = admin
      .from('listing_events')
      .select('id')
      .eq('listing_id', listingId)
      .eq('event_type', 'view')
      .gte('created_at', since)
      .limit(1)

    if (sessionId) duplicateQuery = duplicateQuery.eq('session_id', sessionId)
    else if (effectiveUserId) duplicateQuery = duplicateQuery.eq('user_id', effectiveUserId)
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
  const { error } = await admin.from('listing_events').insert({
    listing_id: listingId,
    user_id: effectiveUserId,
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
  const cookieStore = await cookies()
  const accountUserId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  const effectiveUserId = accountUserId || user?.id || null
  const searchParams = new URL(request.url).searchParams
  const listingId = searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })

  if (searchParams.get('stats') === '1') {
    if (!effectiveUserId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const admin = serviceClient()
    const { data: listing } = await admin.from('listings').select('id,owner_id').eq('id', listingId).maybeSingle()
    if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
    if (listing.owner_id !== effectiveUserId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    const { data: events, error } = await admin
      .from('listing_events')
      .select('event_type,user_id,session_id,created_at')
      .eq('listing_id', listingId)
      .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'STATISTICS_LOAD_FAILED' }, { status: 500 })

    const rows = events || []
    const uniqueKeys = new Set<string>()
    let views = 0
    let shares = 0
    let phoneClicks = 0
    let chatStarts = 0
    let todayViews = 0
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
    const todayStart = new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - 5 * 60 * 60 * 1000)

    for (const event of rows) {
      if (event.event_type === 'view') {
        uniqueKeys.add(event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`))
        views += 1
        if (new Date(event.created_at) >= todayStart) todayViews += 1
      } else if (event.event_type === 'share') shares += 1
      else if (event.event_type === 'phone_click') phoneClicks += 1
      else if (event.event_type === 'chat_start') chatStarts += 1
    }

    return NextResponse.json(
      { views, uniqueViews: uniqueKeys.size, todayViews, shares, phoneClicks, chatStarts },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  }

  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const { data } = await supabase.from('listing_favorites').select('listing_id').eq('user_id', user.id).eq('listing_id', listingId).maybeSingle()
  return NextResponse.json({ favorite: Boolean(data) })
}
