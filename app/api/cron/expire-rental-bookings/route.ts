import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { expirePendingRentalBookings } from '@/utils/rentals/expire-pending-bookings'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const result = await expirePendingRentalBookings(serviceClient())
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[Rental booking expiry] Failed', error)
    return NextResponse.json({ error: 'RENTAL_BOOKING_EXPIRY_FAILED' }, { status: 500 })
  }
}
