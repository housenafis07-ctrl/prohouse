import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const eventTypes = new Set(['view','favorite','unfavorite','phone_click','chat_start','share','mortgage_click','map_open'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.listingId !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const listingId = body.listingId
  const action = typeof body.action === 'string' ? body.action : ''

  const { data: listing } = await supabase.from('listings').select('id,status,owner_id').eq('id', listingId).maybeSingle()
  if (!listing || (listing.status !== 'active' && listing.owner_id !== user?.id)) {
    return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
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
    await supabase.from('listing_events').insert({ listing_id: listingId, user_id: user.id, session_id: typeof body.sessionId === 'string' ? body.sessionId : null, event_type: action, metadata: {} })
    return NextResponse.json({ ok: true, favorite: action === 'favorite' })
  }

  if (!eventTypes.has(action)) return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  const { error } = await supabase.from('listing_events').insert({
    listing_id: listingId,
    user_id: user?.id ?? null,
    session_id: typeof body.sessionId === 'string' ? body.sessionId : null,
    event_type: action,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const listingId = new URL(request.url).searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })
  const { data } = await supabase.from('listing_favorites').select('listing_id').eq('user_id', user.id).eq('listing_id', listingId).maybeSingle()
  return NextResponse.json({ favorite: Boolean(data) })
}
