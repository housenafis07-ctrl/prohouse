import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { deliverPendingTelegramNotifications, queueTelegramNotification } from '@/utils/telegram/notifications'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const listingId = typeof body.listingId === 'string' ? body.listingId : ''
    const leadType = body.leadType === 'call' || body.leadType === 'chat' ? body.leadType : ''
    if (!listingId || !leadType) return NextResponse.json({ error: 'E’lon va murojaat turi ko‘rsatilishi kerak.' }, { status: 400 })

    // Telefon raqamini ko‘rish public bo‘lishi kerak. Chat esa autentifikatsiyani talab qiladi.
    if (!user && leadType !== 'call') {
      return NextResponse.json({ error: 'Murojaat yuborish uchun tizimga kiring.' }, { status: 401 })
    }

    const admin = serviceClient()
    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id,owner_id,status,seller_phone,seller_name,listing_type,taxonomy_code')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'E’lon topilmadi yoki faol emas.' }, { status: 404 })
    if (user && listing.owner_id === user.id) return NextResponse.json({ error: 'O‘zingizning e’loningizga murojaat yubora olmaysiz.' }, { status: 400 })

    const isRental = listing.listing_type === 'daily' || listing.taxonomy_code === 'rent_dacha'
    if (isRental) {
      return NextResponse.json({
        error: 'Dacha ijarasida bevosita telefon va chat bron tasdiqlanib, avans to‘langandan keyin ochiladi.'
      }, { status: 403 })
    }

    const { data: lead, error: leadError } = await admin.from('listing_leads').insert({
      listing_id: listing.id,
      owner_id: listing.owner_id,
      visitor_id: user?.id ?? null,
      lead_type: leadType,
    }).select('id,listing_id,lead_type,status,created_at').single()
    if (leadError) throw leadError

    if (leadType === 'chat') {
      let conversationId: string | null = null
      const { data: existing } = await admin.from('conversations').select('id').eq('listing_id', listing.id).in('id', (
        await admin.from('conversation_participants').select('conversation_id').eq('user_id', user!.id)
      ).data?.map((x: any) => x.conversation_id) ?? []).limit(1).maybeSingle()
      conversationId = existing?.id ?? null

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await admin.from('conversations').insert({ listing_id: listing.id }).select('id').single()
        if (conversationError) throw conversationError
        conversationId = conversation.id
        const { error: participantsError } = await admin.from('conversation_participants').insert([
          { conversation_id: conversationId, user_id: user!.id },
          { conversation_id: conversationId, user_id: listing.owner_id },
        ])
        if (participantsError) throw participantsError
      }
      const { error: messageError } = await admin.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        body: `Assalomu alaykum! «${listing.seller_name || 'E’lon'}» e’loni bo‘yicha murojaat qilmoqdaman.`,
      })
      if (messageError) throw messageError

      // Keep the first listing inquiry in the site's in-app notification center too.
      try {
        const { error: notificationError } = await admin.from('notifications').insert({
          user_id: listing.owner_id,
          title: 'RoyalHouse — e’loningiz bo‘yicha yangi murojaat',
          body: `🏠 ${listing.seller_name || 'E’lon'}\nXaridor sizga yozishma yubordi.`,
          link: `/chat?conversationId=${encodeURIComponent(conversationId)}`,
          conversation_id: conversationId,
        })
        if (notificationError) console.error('[Chat lead in-app notification] Insert failed', notificationError)
      } catch (notificationError) {
        console.error('[Chat lead in-app notification] Failed', notificationError)
      }

      // Notify the listing owner in Telegram if they have explicitly linked @RoyalHouseUz_bot.
      try {
        await queueTelegramNotification(
          admin,
          listing.owner_id,
          'listing_lead',
          `💬 RoyalHouse — e’loningiz bo‘yicha yangi murojaat\n🏠 ${listing.seller_name || 'E’lon'}\nXaridor sizga yozishma yubordi.\n\nYozishmani ochish: ${(process.env.NEXT_PUBLIC_SITE_URL || 'https://royalhouse.uz').replace(/\/$/, '')}/chat?conversationId=${encodeURIComponent(conversationId)}`,
        )
        await deliverPendingTelegramNotifications(admin, 20)
      } catch (telegramError) {
        console.error('[Telegram lead notification] Delivery failed', telegramError)
      }

      return NextResponse.json({ lead, conversationId })
    }

    // Telefon ko‘rilganini e’lon statistikasiga yozamiz. Bu foydalanuvchi login qilmagan bo‘lsa ham ishlaydi.
    const { error: eventError } = await admin.from('listing_events').insert({
      listing_id: listing.id,
      user_id: user?.id ?? null,
      session_id: typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 128) || null : null,
      event_type: 'phone_click',
      metadata: { source: 'listing_lead' },
    })
    if (eventError) throw eventError

    return NextResponse.json({ lead, phone: listing.seller_phone })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Murojaatni yuborib bo‘lmadi.' }, { status: 500 })
  }
}
