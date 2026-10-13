import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { expirePendingRentalBookings } from '@/utils/rentals/expire-pending-bookings'
import { deliverPendingTelegramNotifications } from '@/utils/telegram/notifications'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    const { id } = await context.params
    const db = serviceClient()
    await expirePendingRentalBookings(db)
    await deliverPendingTelegramNotifications(db)
    const { data: booking, error: bookingError } = await db.from('rental_bookings')
      .select('id,listing_id,guest_id,check_in,check_out,guests,currency,total_amount,deposit_percent,deposit_amount,payment_provider,payment_status,status,created_at,updated_at,paid_at,provider_payment_id,provider_payload')
      .eq('id', id).maybeSingle()
    if (bookingError) throw bookingError
    if (!booking || (booking.provider_payload as any)?.expired_at) return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })

    const [{ data: listing, error: listingError }, { data: guest, error: guestError }] = await Promise.all([
      db.from('listings').select('id,title,title_ru,owner_id,primary_image_url,city,district,seller_phone').eq('id', booking.listing_id).maybeSingle(),
      db.from('profiles').select('id,full_name,phone').eq('id', booking.guest_id).maybeSingle(),
    ])
    if (listingError) throw listingError
    if (guestError) throw guestError
    const isCustomer = booking.guest_id === user.id
    const isPartner = listing?.owner_id === user.id
    if (!isCustomer && !isPartner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    const payload = (booking.provider_payload || {}) as Record<string, any>
    const payme = (payload.payme || {}) as Record<string, any>
    const paid = booking.payment_status === 'paid' && booking.status === 'confirmed' && booking.payment_provider === 'payme' && Boolean(booking.provider_payment_id) && Number.isFinite(Number(payme.amount)) && Number(payme.amount) > 0 && Boolean(booking.paid_at)
    const receipt = paid ? {
      bookingNumber: booking.id.slice(0, 8).toUpperCase(),
      bookingId: booking.id,
      amount: Number(payme.amount) / 100,
      currency: booking.currency,
      paidAt: booking.paid_at,
      transactionId: booking.provider_payment_id,
      status: 'paid',
      provider: 'Payme',
    } : null
    return NextResponse.json({
      booking: {
        id: booking.id, bookingNumber: booking.id.slice(0, 8).toUpperCase(),
        checkIn: booking.check_in, checkOut: booking.check_out, guests: booking.guests,
        currency: booking.currency, totalAmount: Number(booking.total_amount),
        depositPercent: Number(booking.deposit_percent), depositAmount: Number(booking.deposit_amount),
        paymentProvider: booking.payment_provider, paymentStatus: booking.payment_status, status: booking.status,
        createdAt: booking.created_at, updatedAt: booking.updated_at, paidAt: booking.paid_at,
        providerPaymentId: booking.provider_payment_id,
        listing: listing ? { id: listing.id, title: listing.title, titleRu: listing.title_ru, image: listing.primary_image_url, city: listing.city, district: listing.district } : null,
        guest: isPartner ? { name: guest?.full_name || null, phone: guest?.phone || null } : null,
        receipt,
      },
      role: isCustomer ? 'customer' : 'partner',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'BOOKING_LOAD_FAILED' }, { status: 500 })
  }
}
