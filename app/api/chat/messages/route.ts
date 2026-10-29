import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/utils/admin/auth'
import { deliverPendingTelegramNotifications, queueTelegramNotification } from '@/utils/telegram/notifications'

export const runtime = 'nodejs'

type PushConfig = { public_key: string | null; private_key: string | null }

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!conversationId || !text) return NextResponse.json({ error: 'conversationId and text are required' }, { status: 400 })
    if (text.length > 5000) return NextResponse.json({ error: 'Xabar juda uzun' }, { status: 400 })

    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!participant) return NextResponse.json({ error: 'Bu suhbatga kirish huquqi yo‘q' }, { status: 403 })

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
      .select('id,sender_id,body,created_at')
      .single()
    if (insertError || !message) return NextResponse.json({ error: insertError?.message || 'Xabar yuborilmadi' }, { status: 500 })

    // Persist in-app notifications as well as Telegram/push delivery. The chat UI
    // reads this table; a browser push alone does not create an inbox notification.
    try {
      const admin = serviceClient()
      const [{ data: recipients }, { data: conversation }] = await Promise.all([
        admin.from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', user.id),
        admin.from('conversations').select('listing_id, listings(title)').eq('id', conversationId).maybeSingle(),
      ])
      const listingTitle = (conversation as any)?.listings?.title || 'E’lon'
      const preview = text.length > 240 ? `${text.slice(0, 240)}…` : text
      if (recipients?.length) {
        const { error: notificationError } = await admin.from('notifications').insert(recipients.map(recipient => ({
          user_id: recipient.user_id,
          title: 'RoyalHouse — yangi xabar',
          body: `🏠 ${listingTitle}\n${preview}`,
          link: `/chat?conversationId=${encodeURIComponent(conversationId)}`,
          conversation_id: conversationId,
        })))
        if (notificationError) console.error('[Chat in-app notification] Insert failed', notificationError)
      }
    } catch (notificationError) {
      console.error('[Chat in-app notification] Failed', notificationError)
    }

    // Keep a defined canonical site URL for Telegram links. Without this, every
    // post-inquiry chat notification throws before it can be queued or delivered.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')

    // Telegram notifications are best-effort and only sent to users who explicitly linked the bot.
    try {
      const admin = serviceClient()
      const [{ data: recipients }, { data: conversation }] = await Promise.all([
        admin.from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', user.id),
        admin.from('conversations').select('listing_id, listings(title)').eq('id', conversationId).maybeSingle(),
      ])
      const listingTitle = (conversation as any)?.listings?.title || 'E’lon'
      const preview = text.length > 240 ? `${text.slice(0, 240)}…` : text
      await Promise.all((recipients || []).map((recipient) =>
        queueTelegramNotification(
          admin,
          recipient.user_id,
          'listing_message',
          `💬 RoyalHouse — e’lon bo‘yicha yangi xabar\n🏠 ${listingTitle}\n\n${preview}\n\nYozishmani ochish: ${siteUrl}/chat?conversationId=${encodeURIComponent(conversationId)}`,
        ),
      ))
      await deliverPendingTelegramNotifications(admin, 20)
    } catch (telegramError) {
      console.error('[Telegram chat notification] Delivery failed', telegramError)
    }

    // Push is deliberately best-effort: a push failure must never undo a saved chat message.
    try {
      const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      const { data: rawConfig } = await admin.rpc('get_push_config').maybeSingle()
      const config = rawConfig as unknown as PushConfig | null
      if (config?.public_key && config.private_key) {
        const { data: recipients } = await admin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id)
        const recipientIds = (recipients ?? []).map(row => row.user_id)

        if (recipientIds.length) {
          const { data: conversation } = await admin
            .from('conversations')
            .select('listing_id, listings(title)')
            .eq('id', conversationId)
            .maybeSingle()
          const listingTitle = (conversation as any)?.listings?.title || 'E’lon'
          const { data: subscriptions } = await admin
            .from('push_subscriptions')
            .select('id,user_id,endpoint,p256dh,auth')
            .in('user_id', recipientIds)

          webpush.setVapidDetails('mailto:admin@royalhouse.uz', config.public_key, config.private_key)
          const payload = JSON.stringify({
            title: 'Royalhouse — yangi xabar',
            body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
            url: `/chat?conversationId=${conversationId}`,
            listingTitle,
          })

          for (const subscription of subscriptions ?? []) {
            try {
              await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                payload,
              )
            } catch (pushError: any) {
              if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
                await admin.from('push_subscriptions').delete().eq('id', subscription.id)
              }
            }
          }
        }
      }
    } catch {
      // Chat delivery is independent from optional browser push delivery.
    }

    return NextResponse.json({ message, push: 'attempted' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Xabar yuborishda xatolik' }, { status: 500 })
  }
}
