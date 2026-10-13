import type { SupabaseClient } from '@supabase/supabase-js'

/** Queue a Telegram message only for a profile that has explicitly linked the bot. */
export async function queueTelegramNotification(
  db: SupabaseClient,
  profileId: string | null | undefined,
  eventType: string,
  message: string,
) {
  if (!profileId) return
  try {
    const { data: link, error: linkError } = await db
      .from('telegram_user_links')
      .select('profile_id')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (linkError) throw linkError
    if (!link) return
    const { error } = await db.from('telegram_notification_queue').insert({
      profile_id: profileId,
      event_type: eventType,
      message: message.slice(0, 3500),
    })
    if (error) throw error
  } catch (error) {
    // Notifications must never roll back a successful booking/payment.
    console.error('[Telegram notification] Queue failed', { eventType, error })
  }
}
