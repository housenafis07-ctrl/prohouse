import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN_MISSING' }, { status: 503 })

  const db = serviceClient()
  const { data: queue, error } = await db.from('telegram_notification_queue')
    .select('id,profile_id,message,attempts')
    .is('sent_at', null)
    .lt('attempts', 8)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) {
    console.error('[Telegram notification worker] Queue read failed', error)
    return NextResponse.json({ error: 'QUEUE_READ_FAILED' }, { status: 500 })
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
  return NextResponse.json({ ok: true, processed: (queue || []).length, sent, failed })
}
