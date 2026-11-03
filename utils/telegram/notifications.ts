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

/**
 * Best-effort delivery. The database lease prevents concurrent workers from
 * claiming the same row. A successful Telegram send is acknowledged separately:
 * if the DB acknowledgement fails, keep the lease until expiry instead of
 * immediately releasing the row and causing an avoidable duplicate send.
 */
export async function deliverPendingTelegramNotifications(db: SupabaseClient, limit = 20) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[Telegram notification] TELEGRAM_BOT_TOKEN is not configured')
    return { sent: 0, failed: 0 }
  }

  const { data: queue, error } = await db.rpc('claim_telegram_notification_queue', { p_limit: limit })
  if (error) {
    console.error('[Telegram notification] Queue claim failed', error)
    return { sent: 0, failed: 1 }
  }

  let sent = 0
  let failed = 0

  for (const item of queue || []) {
    const { data: link, error: linkError } = await db
      .from('telegram_user_links')
      .select('chat_id')
      .eq('profile_id', item.profile_id)
      .maybeSingle()

    if (linkError || !link) {
      const { error: releaseError } = await db
        .from('telegram_notification_queue')
        .update({
          attempts: Number(item.attempts || 0) + 1,
          last_error: linkError?.message || 'Telegram account not linked',
          locked_until: null,
        })
        .eq('id', item.id)
        .is('sent_at', null)
      if (releaseError) console.error('[Telegram notification] Failed to release unlinked queue item', releaseError)
      failed++
      continue
    }

    let sendError: Error | null = null
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: link.chat_id, text: item.message, disable_web_page_preview: true }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.description || 'Telegram sendMessage failed')
    } catch (error) {
      sendError = error instanceof Error ? error : new Error('Telegram delivery failed')
    }

    if (sendError) {
      const { error: releaseError } = await db
        .from('telegram_notification_queue')
        .update({
          attempts: Number(item.attempts || 0) + 1,
          last_error: sendError.message.slice(0, 1000),
          locked_until: null,
        })
        .eq('id', item.id)
        .is('sent_at', null)
      if (releaseError) console.error('[Telegram notification] Failed to release failed queue item', releaseError)
      failed++
      continue
    }

    // Telegram accepted the message. If this acknowledgement fails, do not
    // clear the lease: it will expire naturally, avoiding an immediate resend.
    const { error: markError } = await db
      .from('telegram_notification_queue')
      .update({
        sent_at: new Date().toISOString(),
        attempts: Number(item.attempts || 0) + 1,
        last_error: null,
        locked_until: null,
      })
      .eq('id', item.id)
      .is('sent_at', null)

    if (markError) {
      console.error('[Telegram notification] Message sent but queue acknowledgement failed; lease retained until expiry', {
        queueId: item.id,
        error: markError,
      })
    }
    sent++
  }

  return { sent, failed }
}
