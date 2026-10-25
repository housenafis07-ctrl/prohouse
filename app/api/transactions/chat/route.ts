import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const serviceCode = (value: string | null | undefined) => Boolean(value && (value === 'services' || value.startsWith('services_')))

export async function GET(request: NextRequest) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

    const conversationId = request.nextUrl.searchParams.get('conversationId')?.trim() || ''
    if (!conversationId) return NextResponse.json({ error: 'conversationId majburiy.' }, { status: 400 })

    const admin = serviceClient()
    const { data: participant } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!participant) return NextResponse.json({ error: 'Bu suhbatga kirish huquqi yo‘q.' }, { status: 403 })

    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id,listing_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Suhbat topilmadi.' }, { status: 404 })

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id,owner_id,title,price,taxonomy_code,listing_type,property_type')
      .eq('id', conversation.listing_id)
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'E’lon topilmadi.' }, { status: 404 })

    const isSeller = user.id === listing.owner_id

    const { data: category } = await admin
      .from('listing_categories')
      .select('entity_type')
      .eq('code', listing.taxonomy_code || '')
      .maybeSingle()
    const isService = category?.entity_type === 'service' || serviceCode(listing.taxonomy_code)

    const { data: participantRows, error: participantsError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
    if (participantsError) throw participantsError

    const participantIds = (participantRows ?? []).map(row => row.user_id)
    const buyerCandidates = participantIds.filter(id => id !== listing.owner_id)
    const buyerId = isSeller ? buyerCandidates[0] : user.id

    if (!buyerId || buyerId === listing.owner_id) {
      return NextResponse.json({
        kind: isService ? 'service' : 'property',
        transaction: null,
        serviceOrder: null,
        lead: null,
        listing,
        role: null,
        nextStatus: null,
        nextActor: null,
        canAdvance: false,
      })
    }

    const { data: lead, error: leadError } = await admin
      .from('listing_leads')
      .select('id,listing_id,owner_id,visitor_id,status,lead_type,created_at')
      .eq('listing_id', listing.id)
      .eq('owner_id', listing.owner_id)
      .eq('visitor_id', buyerId)
      .eq('lead_type', 'chat')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (leadError) throw leadError

    if (!lead) return NextResponse.json({
      kind: isService ? 'service' : 'property',
      transaction: null,
      serviceOrder: null,
      lead: null,
      listing,
      role: isSeller ? 'seller' : 'buyer',
      nextStatus: null,
      nextActor: null,
      canAdvance: false,
    })

    if (isService) {
      const { data: serviceOrder, error: serviceOrderError } = await admin
        .from('service_orders')
        .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at,created_at,updated_at')
        .eq('lead_id', lead.id)
        .maybeSingle()
      if (serviceOrderError) throw serviceOrderError

      const role = user.id === listing.owner_id ? 'seller' : 'buyer'
      const agreedByMe = role === 'seller' ? Boolean(serviceOrder?.seller_agreed_at) : Boolean(serviceOrder?.buyer_agreed_at)
      const completedByMe = role === 'seller' ? Boolean(serviceOrder?.seller_completed_at) : Boolean(serviceOrder?.buyer_completed_at)
      const agreedByBoth = Boolean(serviceOrder?.buyer_agreed_at && serviceOrder?.seller_agreed_at)
      const completedByBoth = Boolean(serviceOrder?.buyer_completed_at && serviceOrder?.seller_completed_at)

      return NextResponse.json({
        kind: 'service',
        transaction: null,
        serviceOrder,
        lead,
        listing,
        role,
        agreedByMe,
        completedByMe,
        agreedByBoth,
        completedByBoth,
        canAdvance: Boolean(serviceOrder && serviceOrder.status !== 'completed' && serviceOrder.status !== 'cancelled'),
      })
    }

    // Property/dacha flow remains unchanged.
    const { data: transaction, error: transactionError } = await admin
      .from('property_transactions')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,amount,currency,metadata,created_at,updated_at')
      .eq('lead_id', lead.id)
      .maybeSingle()
    if (transactionError) throw transactionError

    const tx = transaction ?? null
    if (tx && tx.buyer_id !== user.id && tx.seller_id !== user.id) {
      return NextResponse.json({ error: 'Bu tranzaksiyaga kirish huquqi yo‘q.' }, { status: 403 })
    }

    const role = tx ? (tx.buyer_id === user.id ? 'buyer' : 'seller') : (isSeller ? 'seller' : 'buyer')
    const nextByStatus: Record<string, { status: string; actor: string }> = {
      lead: { status: 'viewing', actor: 'seller' },
      viewing: { status: 'offer', actor: 'buyer' },
      offer: { status: 'deal', actor: 'seller' },
      deal: { status: 'payment', actor: 'buyer' },
      payment: { status: 'contract', actor: 'seller' },
    }
    const next = tx ? nextByStatus[tx.status] ?? null : null

    return NextResponse.json({
      kind: 'property',
      transaction: tx,
      serviceOrder: null,
      lead,
      listing,
      role,
      nextStatus: next?.status ?? null,
      nextActor: next?.actor ?? null,
      canAdvance: Boolean(next && next.actor === role),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Chat transactionini olishda xatolik.' }, { status: 500 })
  }
}
