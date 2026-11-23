import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Release unpaid dacha reservations whose payment window has elapsed.
 * Conditional updates ensure a concurrent successful Payme payment wins safely.
 */
export async function expirePendingRentalBookings(db: SupabaseClient) {
  const now = new Date()
  const nowIso = now.toISOString()
  const { data: due, error } = await db
    .from('rental_bookings')
    .select('id,payment_status,provider_payload')
    .eq('status', 'pending_payment')
    .in('payment_status', ['pending', 'processing'])
    .not('payment_expires_at', 'is', null)
    .lte('payment_expires_at', nowIso)

  if (error) throw error
  let expired = 0

  for (const booking of due || []) {
    const payload = (booking.provider_payload || {}) as Record<string, any>
    const payme = (payload.payme || {}) as Record<string, any>
    const nextPayload = {
      ...payload,
      expired_at: nowIso,
      payme: {
        ...payme,
        cancel_time: payme.cancel_time || now.getTime(),
        state: Number(payme.perform_time || 0) > 0 ? -2 : -1,
      },
    }

    const { data, error: updateError } = await db
      .from('rental_bookings')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        provider_payload: nextPayload,
        updated_at: nowIso,
      })
      .eq('id', booking.id)
      .eq('status', 'pending_payment')
      .in('payment_status', ['pending', 'processing'])
      .lte('payment_expires_at', nowIso)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (data) expired += 1
  }

  return { expired }
}
