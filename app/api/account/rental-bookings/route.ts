import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const db = serviceClient()
    const [{ data: customerRows, error: customerError }, { data: ownedListings, error: listingsError }] = await Promise.all([
      db.from('rental_bookings').select('id,listing_id,guest_id,check_in,check_out,guests,currency,total_amount,deposit_percent,deposit_amount,payment_provider,payment_status,status,created_at,paid_at,provider_payment_id,provider_payload').eq('guest_id', user.id).order('created_at', { ascending: false }),
      db.from('listings').select('id,title,title_ru,owner_id,primary_image_url,city,district').eq('owner_id', user.id).eq('taxonomy_code', 'rent_dacha'),
    ])
    if (customerError) throw customerError
    if (listingsError) throw listingsError

    const ownedIds = (ownedListings || []).map((row: any) => row.id)
    let partnerRows: any[] = []
    if (ownedIds.length) {
      const { data, error } = await db.from('rental_bookings').select('id,listing_id,guest_id,check_in,check_out,guests,currency,total_amount,deposit_percent,deposit_amount,payment_provider,payment_status,status,created_at,paid_at,provider_payment_id,provider_payload').in('listing_id', ownedIds).order('created_at', { ascending: false })
      if (error) throw error
      partnerRows = data || []
    }

    const merged = new Map<string, { booking: any; role: 'customer' | 'partner' }>()
    for (const booking of partnerRows) merged.set(booking.id, { booking, role: 'partner' })
    for (const booking of customerRows || []) merged.set(booking.id, { booking, role: merged.has(booking.id) ? 'customer' : 'customer' })
    const entries = Array.from(merged.values())
    const listingIds = Array.from(new Set(entries.map(x => x.booking.listing_id)))
    const guestIds = Array.from(new Set(entries.map(x => x.booking.guest_id)))
    const [{ data: listingDetails, error: detailError }, { data: profiles, error: profileError }] = await Promise.all([
      listingIds.length ? db.from('listings').select('id,title,title_ru,owner_id,primary_image_url,city,district').in('id', listingIds) : Promise.resolve({ data: [], error: null } as any),
      guestIds.length ? db.from('profiles').select('id,full_name,phone').in('id', guestIds) : Promise.resolve({ data: [], error: null } as any),
    ])
    if (detailError) throw detailError
    if (profileError) throw profileError
    const listingMap = new Map((listingDetails || []).map((x: any) => [x.id, x]))
    const profileMap = new Map((profiles || []).map((x: any) => [x.id, x]))
    const result = entries.map(({ booking, role }) => {
      const listing: any = listingMap.get(booking.listing_id)
      const guest: any = profileMap.get(booking.guest_id)
      const payme = (booking.provider_payload as any)?.payme || {}
      return {
        id: booking.id, bookingNumber: booking.id.slice(0, 8).toUpperCase(), role,
        checkIn: booking.check_in, checkOut: booking.check_out, guests: booking.guests,
        currency: booking.currency, totalAmount: Number(booking.total_amount), depositPercent: Number(booking.deposit_percent),
        depositAmount: Number(booking.deposit_amount), paymentProvider: booking.payment_provider,
        paymentStatus: booking.payment_status, status: booking.status, createdAt: booking.created_at,
        paidAt: booking.paid_at, providerPaymentId: booking.provider_payment_id,
        paymeAmount: Number.isFinite(Number(payme.amount)) ? Number(payme.amount) / 100 : null,
        listing: listing ? { id: listing.id, title: listing.title, titleRu: listing.title_ru, image: listing.primary_image_url, city: listing.city, district: listing.district } : null,
        guest: role === 'partner' ? { name: guest?.full_name || null, phone: guest?.phone || null } : null,
      }
    })
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json({ bookings: result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'BOOKINGS_LOAD_FAILED' }, { status: 500 })
  }
}
