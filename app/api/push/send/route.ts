import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type PushConfig = {
  public_key: string | null
  private_key: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: rawPushConfig, error: configError } = await admin.rpc('get_push_config').maybeSingle()
    const pushConfig = rawPushConfig as unknown as PushConfig | null
    if (configError || !pushConfig?.public_key || !pushConfig.private_key) {
      return NextResponse.json({ ok: false, configured: false }, { status: 503 })
    }

    const { messageId } = await request.json()
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })

    const { data: message, error: messageError } = await admin
      .from('messages')
      .select('id,conversation_id,sender_id,body,created_at')
      .eq('id', messageId)
      .single()
    if (messageError || !message || message.sender_id !== user.id) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    const { data: participants } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id)
      .neq('user_id', user.id)
    const recipients = (participants || []).map(row => row.user_id)
    if (!recipients.length) return NextResponse.json({ ok: true, sent: 0 })

    const { data: listing } = await admin
      .from('conversations')
      .select('listing_id, listings(title)')
      .eq('id', message.conversation_id)
      .maybeSingle()
    const listingTitle = (listing as any)?.listings?.title || 'E’lon'

    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
      .in('user_id', recipients)

    webpush.setVapidDetails('mailto:admin@prohouse.uz', pushConfig.public_key, pushConfig.private_key)
    const payload = JSON.stringify({
      title: 'Prohouse — yangi xabar',
      body: message.body.length > 140 ? `${message.body.slice(0, 140)}…` : message.body,
      url: `/chat?conversationId=${message.conversation_id}`,
      listingTitle,
    })

    let sent = 0
    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload)
        sent += 1
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      }
    }
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Push failed' }, { status: 500 })
  }
}
