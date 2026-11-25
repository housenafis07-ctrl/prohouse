import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type PushConfig = { public_key: string | null; private_key: string | null }
type SavedSearch = { id: string; user_id: string; name: string; query: Record<string, unknown>; created_at: string; notify_push: boolean; is_active: boolean }
type SearchListing = { id: string; title: string; title_ru?: string | null; published_at?: string | null; price?: number | null; currency?: string | null }

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function searchUrl(query: Record<string, unknown>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value === null || value === undefined || value === '' || typeof value === 'object') continue
    params.set(key, String(value))
  }
  params.set('limit', '48')
  params.set('sort', 'newest')
  return `${SITE_URL}/api/listings/search?${params.toString()}`
}

function formatPrice(listing: SearchListing) {
  if (listing.price == null) return ''
  return new Intl.NumberFormat('uz-UZ').format(listing.price) + (listing.currency === 'USD' ? ' $' : ' so‘m')
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const [{ data: searches, error: searchesError }, { data: rawConfig, error: configError }] = await Promise.all([
    db.from('saved_searches').select('id,user_id,name,query,created_at,notify_push,is_active').eq('is_active', true).limit(200),
    db.rpc('get_push_config').maybeSingle(),
  ])
  if (searchesError) {
    console.error('[saved-search-alerts] search load failed', searchesError)
    return NextResponse.json({ error: 'Could not load saved searches' }, { status: 500 })
  }

  const config = rawConfig as unknown as PushConfig | null
  const pushReady = !configError && Boolean(config?.public_key && config?.private_key)
  if (pushReady) webpush.setVapidDetails('mailto:admin@royalhouse.uz', config!.public_key!, config!.private_key!)

  let matches = 0
  let pushSent = 0
  let telegramQueued = 0
  let failed = 0

  for (const search of (searches || []) as SavedSearch[]) {
    try {
      const response = await fetch(searchUrl(search.query || {}), { cache: 'no-store', signal: AbortSignal.timeout(12000) })
      if (!response.ok) throw new Error(`Search API returned ${response.status}`)
      const result = await response.json()
      const rows = (result.data || []) as SearchListing[]
      const fresh = rows.filter(row => row.id && (!row.published_at || new Date(row.published_at).getTime() >= new Date(search.created_at).getTime()))

      for (const listing of fresh) {
        const listingUrl = `/listings/${encodeURIComponent(listing.id)}`
        const { data: delivery, error: insertError } = await db.from('saved_search_alert_deliveries').upsert({
          saved_search_id: search.id,
          user_id: search.user_id,
          listing_id: listing.id,
          listing_title: listing.title || 'Yangi e’lon',
          listing_url: listingUrl,
        }, { onConflict: 'saved_search_id,listing_id', ignoreDuplicates: true }).select('id').maybeSingle()

        if (insertError) throw insertError
        if (!delivery) continue
        matches++

        const title = 'RoyalHouse — yangi mos e’lon'
        const price = formatPrice(listing)
        const body = [listing.title || 'Saqlangan qidiruvingizga mos yangi e’lon', price].filter(Boolean).join(' · ')
        const message = `🔔 RoyalHouse — saqlangan qidiruvingizga yangi e’lon topildi\n\n🏠 ${listing.title || 'Yangi e’lon'}${price ? `\n💰 ${price}` : ''}\n\n🔗 ${SITE_URL}${listingUrl}`

        if (search.notify_push && pushReady) {
          const { data: subscriptions, error: subscriptionError } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', search.user_id)
          if (subscriptionError) throw subscriptionError
          let sent = false
          for (const sub of subscriptions || []) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
                title, body, url: listingUrl, icon: '/royalhouse-icon.svg', badge: '/royalhouse-icon.svg',
              }))
              sent = true
            } catch (error: any) {
              if (error?.statusCode === 404 || error?.statusCode === 410) {
                await db.from('push_subscriptions').delete().eq('id', sub.id)
              } else {
                console.warn('[saved-search-alerts] push delivery failed', error)
              }
            }
          }
          if (sent) {
            await db.from('saved_search_alert_deliveries').update({ push_sent_at: new Date().toISOString() }).eq('id', delivery.id)
            pushSent++
          }
        }

        const { data: link, error: linkError } = await db.from('telegram_user_links').select('profile_id').eq('profile_id', search.user_id).maybeSingle()
        if (linkError) throw linkError
        if (link) {
          const { error: queueError } = await db.from('telegram_notification_queue').insert({
            profile_id: search.user_id,
            event_type: 'saved_search_new_listing',
            message: message.slice(0, 3500),
          })
          if (queueError) throw queueError
          await db.from('saved_search_alert_deliveries').update({ telegram_queued_at: new Date().toISOString() }).eq('id', delivery.id)
          telegramQueued++
        }
      }
    } catch (error) {
      failed++
      console.error('[saved-search-alerts] search processing failed', search.id, error)
    }
  }

  // Deliver the queued Telegram messages using the platform's existing retry-aware dispatcher.
  const { deliverPendingTelegramNotifications } = await import('@/utils/telegram/notifications')
  const telegramDelivery = await deliverPendingTelegramNotifications(db, 100)

  return NextResponse.json({
    ok: true,
    searchesProcessed: (searches || []).length,
    matches,
    pushSent,
    telegramQueued,
    telegramSent: telegramDelivery.sent,
    telegramFailed: telegramDelivery.failed,
    failed,
    pushConfigured: pushReady,
  })
}

export async function GET(request: Request) { return run(request) }
export async function POST(request: Request) { return run(request) }
