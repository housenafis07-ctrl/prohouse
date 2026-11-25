import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { queueTelegramNotification, deliverPendingTelegramNotifications } from '@/utils/telegram/notifications'

const statuses = new Set(['confirmed', 'declined', 'cancelled', 'completed'])

async function currentUser() {
  // The main /account dashboard authenticates through this signed cookie
  // (see /api/account/profile). Prefer the same identity source here so a
  // stale Supabase browser session cannot override the account being shown.
  const store = await cookies()
  const accountUserId = readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (accountUserId) {
    const { data, error } = await serviceClient().auth.admin.getUserById(accountUserId)
    if (error || !data.user) return null
    return { id: data.user.id }
  }

  // Retain Supabase Auth as a fallback for users who do not use the
  // first-party phone-backed account session.
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  return user ? { id: user.id } : null
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

  const db = serviceClient()
  const selection = 'id,listing_id,requester_id,owner_id,requested_at,note,status,responded_at,created_at,updated_at,listing:listings(id,title,title_ru,city,district,price,currency)'

  // Query each ownership direction independently. This avoids an OR filter
  // hiding owner-side rows and makes inbox failures attributable to one side.
  const [incomingResult, outgoingResult] = await Promise.all([
    db
      .from('property_viewing_requests')
      .select(selection)
      .eq('owner_id', user.id)
      .order('requested_at', { ascending: true })
      .limit(100),
    db
      .from('property_viewing_requests')
      .select(selection)
      .eq('requester_id', user.id)
      .order('requested_at', { ascending: true })
      .limit(100),
  ])

  if (incomingResult.error || outgoingResult.error) {
    console.error('[viewing-requests] inbox query failed', {
      userId: user.id,
      incomingError: incomingResult.error,
      outgoingError: outgoingResult.error,
    })
    return NextResponse.json(
      { error: 'Ko‘rish so‘rovlarini yuklab bo‘lmadi.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const byId = new Map<string, any>()
  for (const item of [...(incomingResult.data || []), ...(outgoingResult.data || [])]) {
    byId.set(item.id, item)
  }
  const requests = [...byId.values()].sort(
    (a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()
  )

  return NextResponse.json(
    { requests, currentUserId: user.id },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const listingId = typeof body?.listingId === 'string' ? body.listingId : ''
  const requestedAtRaw = typeof body?.requestedAt === 'string' ? body.requestedAt : ''
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : null
  const requestedAt = new Date(requestedAtRaw)

  if (!listingId || !requestedAtRaw || !Number.isFinite(requestedAt.getTime())) {
    return NextResponse.json({ error: 'E’lon va ko‘rish sanasi majburiy.' }, { status: 400 })
  }
  const now = Date.now()
  if (requestedAt.getTime() < now + 60 * 60 * 1000 || requestedAt.getTime() > now + 90 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Ko‘rish vaqti kamida 1 soat keyin va 90 kun ichida bo‘lishi kerak.' }, { status: 400 })
  }

  const db = serviceClient()
  const { data: listing, error: listingError } = await db
    .from('listings')
    .select('id,owner_id,title,status,listing_type,taxonomy_code')
    .eq('id', listingId)
    .eq('status', 'active')
    .maybeSingle()
  if (listingError) return NextResponse.json({ error: 'E’lonni tekshirishda xatolik.' }, { status: 500 })
  if (!listing) return NextResponse.json({ error: 'E’lon topilmadi.' }, { status: 404 })
  if (!listing.owner_id) return NextResponse.json({ error: 'Bu e’lon egasi bilan bog‘lanish imkoni yo‘q.' }, { status: 409 })
  if (listing.owner_id === user.id) return NextResponse.json({ error: 'O‘z e’loningiz uchun ko‘rish so‘rovi yubora olmaysiz.' }, { status: 400 })

  // Daily/vacation rentals have a separate date-based reservation and payment lifecycle.
  if (listing.listing_type === 'daily' || listing.taxonomy_code === 'rent_dacha') {
    return NextResponse.json({ error: 'Kunlik ijara va dam olish obyektlari uchun alohida bron kalendaridan foydalaning.' }, { status: 409 })
  }

  const { data: existing, error: existingError } = await db
    .from('property_viewing_requests')
    .select('id,status,requested_at')
    .eq('listing_id', listingId)
    .eq('requester_id', user.id)
    .in('status', ['pending', 'confirmed'])
    .limit(1)
    .maybeSingle()
  if (existingError) {
    console.error('[viewing-requests] active request lookup failed', existingError)
    const missingTable = existingError.code === '42P01' || existingError.code === 'PGRST205'
    return NextResponse.json({ error: missingTable ? 'Ko‘rish so‘rovlari xizmati hali bazada faollashtirilmagan. Texnik sozlash talab qilinadi.' : 'Oldingi so‘rovni tekshirishda xatolik.' }, { status: missingTable ? 503 : 500 })
  }

  const accountUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz'}/account/viewings`
  let savedRequest: any = null
  let rescheduled = false

  if (existing?.status === 'confirmed') {
    return NextResponse.json({
      error: 'Bu so‘rov allaqachon tasdiqlangan. Yangi vaqt yuborish uchun avval shaxsiy kabinetda mavjud so‘rovni bekor qiling.',
      existingRequestId: existing.id,
      accountUrl,
    }, { status: 409 })
  }

  if (existing?.status === 'pending') {
    const { data: updated, error: updateError } = await db
      .from('property_viewing_requests')
      .update({ requested_at: requestedAt.toISOString(), note: note || null })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .select('id,listing_id,requester_id,owner_id,requested_at,note,status,created_at,updated_at')
      .maybeSingle()
    if (updateError) return NextResponse.json({ error: 'Mavjud so‘rov vaqtini yangilab bo‘lmadi.' }, { status: 500 })
    if (!updated) return NextResponse.json({ error: 'So‘rov ayni vaqtda boshqa foydalanuvchi tomonidan o‘zgartirildi. Sahifani yangilang.' }, { status: 409 })
    savedRequest = updated
    rescheduled = true
  } else {
    const { data: created, error: createError } = await db
      .from('property_viewing_requests')
      .insert({
        listing_id: listing.id,
        requester_id: user.id,
        owner_id: listing.owner_id,
        requested_at: requestedAt.toISOString(),
        note: note || null,
      })
      .select('id,listing_id,requester_id,owner_id,requested_at,note,status,created_at,updated_at')
      .single()
    if (createError?.code === '23505') return NextResponse.json({ error: 'Bu e’lon bo‘yicha faol so‘rov boshqa oynada yuborilgan. Shaxsiy kabinetdan tekshiring.', accountUrl }, { status: 409 })
    if (createError) return NextResponse.json({ error: 'Ko‘rish so‘rovini saqlab bo‘lmadi.' }, { status: 500 })
    savedRequest = created
  }

  const dateLabel = new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tashkent' }).format(requestedAt)
  const noteLine = note ? `\nIzoh: ${note}` : ''
  const messageTitle = rescheduled ? '🔄 Ko‘rish so‘rovi vaqti yangilandi' : '🏠 RoyalHouse — yangi ko‘rish so‘rovi'
  await queueTelegramNotification(
    db,
    listing.owner_id,
    rescheduled ? 'viewing_rescheduled' : 'viewing_requested',
    `${messageTitle}\nE’lon: ${listing.title}\nSana: ${dateLabel}${noteLine}\nSo‘rovni ko‘rish va boshqarish: ${accountUrl}`
  )
  await deliverPendingTelegramNotifications(db, 20)

  return NextResponse.json({ request: savedRequest, rescheduled, accountUrl }, { status: rescheduled ? 200 : 201 })
}

export async function PATCH(request: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !statuses.has(status)) return NextResponse.json({ error: 'So‘rov ID yoki status noto‘g‘ri.' }, { status: 400 })

  const db = serviceClient()
  const { data: existing, error: lookupError } = await db
    .from('property_viewing_requests')
    .select('id,requester_id,owner_id,status,requested_at,listing:listings(title)')
    .eq('id', id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'So‘rovni tekshirishda xatolik.' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Ko‘rish so‘rovi topilmadi.' }, { status: 404 })

  const isOwner = existing.owner_id === user.id
  const isRequester = existing.requester_id === user.id
  if (!isOwner && !isRequester) return NextResponse.json({ error: 'Ruxsat yo‘q.' }, { status: 403 })
  if ((status === 'confirmed' || status === 'declined') && !isOwner) return NextResponse.json({ error: 'Faqat e’lon egasi tasdiqlashi yoki rad etishi mumkin.' }, { status: 403 })
  if (status === 'completed' && !isOwner) return NextResponse.json({ error: 'Faqat e’lon egasi ko‘rishni yakunlangan deb belgilashi mumkin.' }, { status: 403 })
  if (status === 'cancelled' && !isRequester) return NextResponse.json({ error: 'Faqat so‘rov yuborgan foydalanuvchi bekor qilishi mumkin.' }, { status: 403 })
  if (existing.status !== 'pending' && !(status === 'cancelled' && existing.status === 'confirmed') && !(status === 'completed' && existing.status === 'confirmed')) {
    return NextResponse.json({ error: 'Bu so‘rov holatini endi o‘zgartirib bo‘lmaydi.' }, { status: 409 })
  }

  const { data: updated, error: updateError } = await db
    .from('property_viewing_requests')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', existing.status)
    .select('id,status,requested_at,responded_at')
    .maybeSingle()
  if (updateError) return NextResponse.json({ error: 'So‘rov holatini saqlab bo‘lmadi.' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'So‘rov boshqa amalda yangilangan. Sahifani yangilang.' }, { status: 409 })

  const dateLabel = new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(existing.requested_at))
  const listingTitle = Array.isArray(existing.listing) ? existing.listing[0]?.title : existing.listing?.title
  const message = status === 'confirmed'
    ? `✅ RoyalHouse — ko‘rish vaqti tasdiqlandi\nE’lon: ${listingTitle || 'Ko‘chmas mulk'}\nSana: ${dateLabel}`
    : status === 'declined'
      ? `❌ RoyalHouse — ko‘rish so‘rovi rad etildi\nE’lon: ${listingTitle || 'Ko‘chmas mulk'}\nSana: ${dateLabel}`
      : status === 'cancelled'
        ? `ℹ️ RoyalHouse — ko‘rish so‘rovi bekor qilindi\nE’lon: ${listingTitle || 'Ko‘chmas mulk'}\nSana: ${dateLabel}`
        : `✓ RoyalHouse — ko‘rish yakunlandi\nE’lon: ${listingTitle || 'Ko‘chmas mulk'}\nSana: ${dateLabel}`
  const recipient = isOwner ? existing.requester_id : existing.owner_id
  await queueTelegramNotification(db, recipient, 'viewing_status_updated', message)
  await deliverPendingTelegramNotifications(db, 20)

  return NextResponse.json({ request: updated })
}
