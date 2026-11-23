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


/** Best-effort delivery; business transactions must not fail if Telegram is down. */
export async function deliverPendingTelegramNotifications(db: SupabaseClient, limit = 50) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[Telegram notification] TELEGRAM_BOT_TOKEN is not configured')
    return { sent: 0, failed: 0 }
  }
  const { data: queue, error } = await db.from('telegram_notification_queue')
    .select('id,profile_id,message,attempts')
    .is('sent_at', null)
    .lt('attempts', 8)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[Telegram notification] Queue read failed', error)
    return { sent: 0, failed: 1 }
  }
  let sent = 0
  let failed = 0
  for (const item of queue || []) {
    const { data: link, error: linkError } = await db.from('telegram_user_links')
      .select('chat_id').eq('profile_id', item.profile_id).maybeSingle()
    if (linkError || !link) {
      await db.from('telegram_notification_queue').update({
        attempts: Number(item.attempts || 0) + 1,
        last_error: linkError?.message || 'Telegram account not linked',
      }).eq('id', item.id)
      failed++
      continue
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: link.chat_id, text: item.message, disable_web_page_preview: true }),
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.description || 'Telegram sendMessage failed')
      const { error: markError } = await db.from('telegram_notification_queue')
        .update({ sent_at: new Date().toISOString(), attempts: Number(item.attempts || 0) + 1, last_error: null })
        .eq('id', item.id).is('sent_at', null)
      if (markError) throw markError
      sent++
    } catch (e) {
      await db.from('telegram_notification_queue').update({
        attempts: Number(item.attempts || 0) + 1,
        last_error: e instanceof Error ? e.message.slice(0, 1000) : 'Telegram delivery failed',
      }).eq('id', item.id).is('sent_at', null)
      failed++
    }
  }
  return { sent, failed }
}
