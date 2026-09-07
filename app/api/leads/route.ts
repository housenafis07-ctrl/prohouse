import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Murojaat yuborish uchun tizimga kiring.' }, { status: 401 })

    const body = await request.json()
    const listingId = typeof body.listingId === 'string' ? body.listingId : ''
    const leadType = body.leadType === 'call' || body.leadType === 'chat' ? body.leadType : ''
    if (!listingId || !leadType) return NextResponse.json({ error: 'E’lon va murojaat turi ko‘rsatilishi kerak.' }, { status: 400 })

    const admin = serviceClient()
    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id,owner_id,status,seller_phone,seller_name')
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'E’lon topilmadi yoki faol emas.' }, { status: 404 })
    if (listing.owner_id === user.id) return NextResponse.json({ error: 'O‘zingizning e’loningizga murojaat yubora olmaysiz.' }, { status: 400 })

    const { data: lead, error: leadError } = await admin.from('listing_leads').insert({
      listing_id: listing.id,
      owner_id: listing.owner_id,
      visitor_id: user.id,
      lead_type: leadType,
    }).select('id,listing_id,lead_type,status,created_at').single()
    if (leadError) throw leadError

    if (leadType === 'chat') {
      let conversationId: string | null = null
      const { data: existing } = await admin.from('conversations').select('id').eq('listing_id', listing.id).in('id', (
        await admin.from('conversation_participants').select('conversation_id').eq('user_id', user.id)
      ).data?.map((x: any) => x.conversation_id) ?? []).limit(1).maybeSingle()
      conversationId = existing?.id ?? null

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await admin.from('conversations').insert({ listing_id: listing.id }).select('id').single()
        if (conversationError) throw conversationError
        conversationId = conversation.id
        const { error: participantsError } = await admin.from('conversation_participants').insert([
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: listing.owner_id },
        ])
        if (participantsError) throw participantsError
      }
      const { error: messageError } = await admin.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: `Assalomu alaykum! «${listing.seller_name || 'E’lon'}» e’loni bo‘yicha murojaat qilmoqdaman.`,
      })
      if (messageError) throw messageError
      return NextResponse.json({ lead, conversationId })
    }

    return NextResponse.json({ lead, phone: listing.seller_phone })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Murojaatni yuborib bo‘lmadi.' }, { status: 500 })
  }
}
