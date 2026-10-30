import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'
import { queueTelegramNotification, deliverPendingTelegramNotifications } from '@/utils/telegram/notifications'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const senderId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
    if (!senderId) return NextResponse.json({ error: 'Xabar yuborish uchun tizimga kiring.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const realtorId = typeof body.realtorId === 'string' ? body.realtorId.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!realtorId || !message) return NextResponse.json({ error: 'Rieltor va xabar matni majburiy.' }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: 'Xabar 2000 belgidan oshmasligi kerak.' }, { status: 400 })

    const admin = serviceClient()
    const { data: realtor, error: realtorError } = await admin
      .from('realtor_profiles')
      .select('id,user_id,display_name,verification_status')
      .eq('id', realtorId)
      .eq('verification_status', 'verified')
      .maybeSingle()
    if (realtorError) throw realtorError
    if (!realtor?.user_id) return NextResponse.json({ error: 'Tasdiqlangan rieltor topilmadi.' }, { status: 404 })
    if (realtor.user_id === senderId) return NextResponse.json({ error: 'O‘zingizga xabar yubora olmaysiz.' }, { status: 400 })

    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .insert({ listing_id: null })
      .select('id')
      .single()
    if (conversationError || !conversation) throw conversationError || new Error('Chat yaratilmadi.')

    const { error: participantsError } = await admin.from('conversation_participants').insert([
      { conversation_id: conversation.id, user_id: senderId },
      { conversation_id: conversation.id, user_id: realtor.user_id },
    ])
    if (participantsError) throw participantsError

    const { error: messageError } = await admin.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: senderId,
      body: message,
    })
    if (messageError) throw messageError

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')
    try {
      const { error } = await admin.from('notifications').insert({
        user_id: realtor.user_id,
        title: 'RoyalHouse — rieltor profilidan yangi murojaat',
        body: realtor.display_name + ': ' + message.slice(0, 220),
        link: '/chat?conversationId=' + encodeURIComponent(conversation.id),
        conversation_id: conversation.id,
      })
      if (error) console.error('[Realtor contact notification] Insert failed', error)
    } catch (notificationError) {
      console.error('[Realtor contact notification] Failed', notificationError)
    }

    try {
      await queueTelegramNotification(
        admin,
        realtor.user_id,
        'realtor_contact',
        '💬 RoyalHouse — yangi murojaat\n👤 Rieltor: ' + realtor.display_name + '\n\n' + message.slice(0, 500) + '\n\nChatni ochish: ' + siteUrl + '/chat?conversationId=' + encodeURIComponent(conversation.id),
      )
      await deliverPendingTelegramNotifications(admin, 20)
    } catch (telegramError) {
      console.error('[Realtor contact Telegram notification] Failed', telegramError)
    }

    return NextResponse.json({ conversationId: conversation.id }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[Realtor contact] Failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Xabar yuborilmadi.' }, { status: 500 })
  }
}
