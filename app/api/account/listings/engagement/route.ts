import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

type Engagement = {
  views: number
  uniqueViews: number
  todayViews: number
  shares: number
  phoneClicks: number
  chatStarts: number
}

const emptyStats = (): Engagement => ({
  views: 0,
  uniqueViews: 0,
  todayViews: 0,
  shares: 0,
  phoneClicks: 0,
  chatStarts: 0,
})

function tashkentDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - 5 * 60 * 60 * 1000)
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const db = serviceClient()
    const { data: listings, error: listingsError } = await db
      .from('listings')
      .select('id')
      .eq('owner_id', userId)
    if (listingsError) {
      console.error('[account/listings/engagement] listings lookup failed', listingsError)
      return NextResponse.json({ error: 'STATISTICS_LOAD_FAILED' }, { status: 500 })
    }

    const result: Record<string, Engagement> = {}
    const ids = (listings || []).map(item => item.id)
    for (const id of ids) result[id] = emptyStats()

    const todayStart = tashkentDayStart().toISOString()
    // Read in bounded batches to avoid Supabase's default 1,000-row response cap.
    for (let index = 0; index < ids.length; index += 100) {
      const batch = ids.slice(index, index + 100)
      let offset = 0
      while (true) {
        const { data: events, error } = await db
          .from('listing_events')
          .select('listing_id,event_type,user_id,session_id,created_at')
          .in('listing_id', batch)
          .in('event_type', ['view', 'share', 'phone_click', 'chat_start'])
          .order('created_at', { ascending: true })
          .range(offset, offset + 999)

        if (error) {
          console.error('[account/listings/engagement] events lookup failed', { userId, error })
          return NextResponse.json({ error: 'STATISTICS_LOAD_FAILED' }, { status: 500 })
        }

        for (const event of events || []) {
          const stats = result[event.listing_id]
          if (!stats) continue
          if (event.event_type === 'view') {
            stats.views += 1
            if (new Date(event.created_at) >= new Date(todayStart)) stats.todayViews += 1
            // A session is one visitor; authenticated events without a session
            // fall back to user ID. Legacy anonymous rows remain individually countable.
            const uniqueKey = event.session_id || (event.user_id ? `user:${event.user_id}` : `event:${event.created_at}`)
            ;(stats as Engagement & { _unique?: Set<string> })._unique ||= new Set<string>()
            ;(stats as Engagement & { _unique?: Set<string> })._unique!.add(uniqueKey)
          } else if (event.event_type === 'share') stats.shares += 1
          else if (event.event_type === 'phone_click') stats.phoneClicks += 1
          else if (event.event_type === 'chat_start') stats.chatStarts += 1
        }

        if (!events || events.length < 1000) break
        offset += 1000
      }
    }

    for (const stats of Object.values(result)) {
      const withUnique = stats as Engagement & { _unique?: Set<string> }
      stats.uniqueViews = withUnique._unique?.size || 0
      delete withUnique._unique
    }

    return NextResponse.json(
      { engagement: result },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[account/listings/engagement] unexpected error', error)
    return NextResponse.json({ error: 'STATISTICS_LOAD_FAILED' }, { status: 500 })
  }
}
