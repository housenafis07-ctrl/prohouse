import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const COMMISSION_RATE = 0.15
const ACTIVE_STATUSES = ['pending', 'confirmed']

const dateOnly = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

const addDays = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

const nightsBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

function jsonNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

async function getListingAndPrices(listingId: string) {
  const admin = serviceClient()
  const { data: listing, error } = await admin
    .from('listings')
    .select('id,owner_id,title,price,currency,status,taxonomy_code')
    .eq('id', listingId)
    .eq('taxonomy_code', 'rent_dacha')
    .maybeSingle()
  if (error) throw error
  if (!listing || listing.status !== 'active') return null

  const { data: attrs, error: attrError } = await admin
    .from('listing_attribute_values')
    .select('value_jsonb,category_attributes!inner(code)')
    .eq('listing_id', listingId)
  if (attrError) throw attrError

  const values: Record<string, unknown> = {}
  for (const row of attrs ?? []) {
    const code = Array.isArray(row.category_attributes) ? row.category_attributes[0]?.code : (row.category_attributes as any)?.code
    if (code) values[code] = row.value_jsonb
  }

  const weekdayPrice = jsonNumber(values.weekday_price) ?? Number(listing.price) || 0
  const weekendPrice = jsonNumber(values.weekend_price) ?? weekdayPrice
  const maxGuests = jsonNumber(values.max_guests)
  return { listing, weekdayPrice, weekendPrice, maxGuests }
}

async function overlaps(listingId: string, from: string, to: string) {
  const admin = serviceClient()
  const { data: bookings, error } = await admin
    .from('dacha_bookings')
    .select('check_in,check_out,status')
    .eq('listing_id', listingId)
    .in('status', ACTIVE_STATUSES)
    .lt('check_in', to)
    .gt('check_out', from)
  if (error) throw error
  if ((bookings ?? []).length) return true

  const { data: blocked, error: blockedError } = await admin
    .from('dacha_blocked_dates')
    .select('start_date,end_date')
    .eq('listing_id', listingId)
    .lt('start_date', to)
    .gt('end_date', from)
  if (blockedError) throw blockedError
  return Boolean((blocked ?? []).length)
}

function calculateTotal(from: string, to: string, weekdayPrice: number, weekendPrice: number) {
  let total = 0
  let cursor = from
  const nights = nightsBetween(from, to)
  for (let i = 0; i < nights; i += 1) {
    const weekday = new Date(`${cursor}T00:00:00Z`).getUTCDay()
    total += weekday === 0 || weekday === 6 ? weekendPrice : weekdayPrice
    cursor = addDays(cursor, 1)
  }
  return { nights, total }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const listingId = url.searchParams.get('listingId')
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
  if (!listingId || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'LISTING_ID_AND_MONTH_REQUIRED' }, { status: 400 })

  try {
    const data = await getListingAndPrices(listingId)
    if (!data) return NextResponse.json({ error: 'DACHA_NOT_FOUND' }, { status: 404 })

    const rangeStart = `${month}-01`
    const nextMonth = new Date(`${rangeStart}T00:00:00Z`)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const rangeEnd = nextMonth.toISOString().slice(0, 10)
    const admin = serviceClient()
    const { data: bookings, error } = await admin
      .from('dacha_bookings')
      .select('id,check_in,check_out,guests,status,total_amount,currency,guest_id,created_at,guest_note,owner_note')
      .eq('listing_id', listingId)
      .in('status', ACTIVE_STATUSES)
      .lt('check_in', rangeEnd)
      .gt('check_out', rangeStart)
      .order('check_in')
    if (error) throw error

    const { data: blocked, error: blockedError } = await admin
      .from('dacha_blocked_dates')
      .select('id,start_date,end_date,reason')
      .eq('listing_id', listingId)
      .lt('start_date', rangeEnd)
      .gt('end_date', rangeStart)
      .order('start_date')
    if (blockedError) throw blockedError

    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    const ownerView = user?.id === data.listing.owner_id
    const guestIds = ownerView ? [...new Set((bookings ?? []).map(b => b.guest_id).filter(Boolean))] : []
    const guestMap = new Map<string, { full_name: string | null; phone: string | null }>()
    if (guestIds.length) {
      const { data: profiles } = await admin.from('profiles').select('id,full_name,phone').in('id', guestIds)
      for (const profile of profiles ?? []) guestMap.set(profile.id, { full_name: profile.full_name, phone: profile.phone })
    }

    const unavailable = (bookings ?? []).map(b => ({ start: b.check_in, end: b.check_out, status: b.status, bookingId: ownerView ? b.id : undefined }))
    const ownerBookings = ownerView ? (bookings ?? []).map(b => ({ ...b, guest: guestMap.get(b.guest_id) || null })) : []

    return NextResponse.json({
      listing: { id: data.listing.id, ownerId: data.listing.owner_id, price: data.listing.price, currency: data.listing.currency, weekdayPrice: data.weekdayPrice, weekendPrice: data.weekendPrice, maxGuests: data.maxGuests },
      unavailable,
      blocked: blocked ?? [],
      ownerView,
      bookings: ownerBookings,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'BOOKING_CALENDAR_FAILED' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null) as any
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const listingId = typeof body.listingId === 'string' ? body.listingId : ''
  const action = typeof body.action === 'string' ? body.action : 'book'
  if (!listingId) return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })

  try {
    const data = await getListingAndPrices(listingId)
    if (!data) return NextResponse.json({ error: 'DACHA_NOT_FOUND' }, { status: 404 })
    const admin = serviceClient()

    if (action === 'block') {
      if (data.listing.owner_id !== user.id) return NextResponse.json({ error: 'OWNER_ONLY' }, { status: 403 })
      const startDate = dateOnly(body.startDate)
      const endDate = dateOnly(body.endDate)
      if (!startDate || !endDate || endDate <= startDate) return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 400 })
      if (await overlaps(listingId, startDate, endDate)) return NextResponse.json({ error: 'DATES_ALREADY_UNAVAILABLE' }, { status: 409 })
      const { data: block, error } = await admin.from('dacha_blocked_dates').insert({ listing_id: listingId, owner_id: user.id, start_date: startDate, end_date: endDate, reason: typeof body.reason === 'string' ? body.reason.trim() || null : null }).select('id,start_date,end_date,reason').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ blocked: block })
    }

    if (action === 'unblock') {
      if (data.listing.owner_id !== user.id) return NextResponse.json({ error: 'OWNER_ONLY' }, { status: 403 })
      const blockId = typeof body.blockId === 'string' ? body.blockId : ''
      if (!blockId) return NextResponse.json({ error: 'BLOCK_ID_REQUIRED' }, { status: 400 })
      const { error } = await admin.from('dacha_blocked_dates').delete().eq('id', blockId).eq('owner_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'status') {
      const bookingId = typeof body.bookingId === 'string' ? body.bookingId : ''
      const nextStatus = typeof body.status === 'string' ? body.status : ''
      if (!bookingId || !['confirmed','rejected','cancelled','completed'].includes(nextStatus)) return NextResponse.json({ error: 'INVALID_BOOKING_STATUS' }, { status: 400 })
      const { data: booking, error: bookingError } = await admin.from('dacha_bookings').select('id,listing_id,guest_id,status').eq('id', bookingId).eq('listing_id', listingId).maybeSingle()
      if (bookingError) throw bookingError
      if (!booking) return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })
      const owner = data.listing.owner_id === user.id
      if (!owner && booking.guest_id !== user.id) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
      if (!owner && nextStatus !== 'cancelled') return NextResponse.json({ error: 'GUEST_CAN_ONLY_CANCEL' }, { status: 403 })
      const { error } = await admin.from('dacha_bookings').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', bookingId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    const checkIn = dateOnly(body.checkIn)
    const checkOut = dateOnly(body.checkOut)
    const guests = Math.max(1, Number(body.guests) || 1)
    if (!checkIn || !checkOut || checkOut <= checkIn) return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 400 })
    if (checkIn < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'CHECK_IN_IN_PAST' }, { status: 400 })
    if (nightsBetween(checkIn, checkOut) > 90) return NextResponse.json({ error: 'MAX_90_NIGHTS' }, { status: 400 })
    if (data.listing.owner_id === user.id) return NextResponse.json({ error: 'OWNER_CANNOT_BOOK_OWN_DACHA' }, { status: 403 })
    if (data.maxGuests && guests > data.maxGuests) return NextResponse.json({ error: 'GUEST_LIMIT_EXCEEDED', maxGuests: data.maxGuests }, { status: 400 })
    if (await overlaps(listingId, checkIn, checkOut)) return NextResponse.json({ error: 'DATES_ALREADY_UNAVAILABLE' }, { status: 409 })

    const { nights, total } = calculateTotal(checkIn, checkOut, data.weekdayPrice, data.weekendPrice)
    const commissionAmount = Math.round(total * COMMISSION_RATE * 100) / 100
    const { data: booking, error } = await admin.from('dacha_bookings').insert({
      listing_id: listingId,
      guest_id: user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      total_amount: total,
      currency: data.listing.currency,
      commission_rate: COMMISSION_RATE,
      commission_amount: commissionAmount,
      status: 'pending',
      guest_note: typeof body.note === 'string' ? body.note.trim() || null : null,
    }).select('id,listing_id,check_in,check_out,guests,total_amount,currency,commission_rate,commission_amount,status,created_at').single()
    if (error) {
      if (error.code === '23P01') return NextResponse.json({ error: 'DATES_ALREADY_UNAVAILABLE' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ booking, nights })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'BOOKING_FAILED' }, { status: 500 })
  }
}
