import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const serviceCode = (value: string | null | undefined) => Boolean(value && (value === 'services' || value.startsWith('services_')))

export async function POST(request: NextRequest) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Xizmat kelishuvini boshlash uchun tizimga kiring.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : ''
    if (!conversationId) return NextResponse.json({ error: 'conversationId majburiy.' }, { status: 400 })

    const admin = serviceClient()
    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id,listing_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Suhbat topilmadi.' }, { status: 404 })

    const { data: participants, error: participantsError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
    if (participantsError) throw participantsError
    const participantIds = (participants ?? []).map(row => row.user_id)
    if (!participantIds.includes(user.id)) return NextResponse.json({ error: 'Bu suhbatga kirish huquqi yo‘q.' }, { status: 403 })

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id,owner_id,taxonomy_code')
      .eq('id', conversation.listing_id)
      .maybeSingle()
    if (listingError) throw listingError
    if (!listing) return NextResponse.json({ error: 'E’lon topilmadi.' }, { status: 404 })

    const { data: category } = await admin
      .from('listing_categories')
      .select('entity_type')
      .eq('code', listing.taxonomy_code || '')
      .maybeSingle()
    if (category?.entity_type !== 'service' && !serviceCode(listing.taxonomy_code)) {
      return NextResponse.json({ error: 'Bu oqim faqat xizmat e’lonlari uchun.' }, { status: 400 })
    }

    const buyerId = user.id === listing.owner_id
      ? participantIds.find(id => id !== listing.owner_id) || null
      : user.id
    if (!buyerId || buyerId === listing.owner_id) return NextResponse.json({ error: 'Xizmat mijozini aniqlab bo‘lmadi.' }, { status: 400 })

    const { data: lead, error: leadError } = await admin
      .from('listing_leads')
      .select('id,listing_id,owner_id,visitor_id,lead_type,status')
      .eq('listing_id', listing.id)
      .eq('owner_id', listing.owner_id)
      .eq('visitor_id', buyerId)
      .eq('lead_type', 'chat')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (leadError) throw leadError
    if (!lead) return NextResponse.json({ error: 'Bu chat uchun murojaat topilmadi.' }, { status: 404 })

    const { data: existing, error: existingError } = await admin
      .from('service_orders')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at,created_at,updated_at')
      .eq('lead_id', lead.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return NextResponse.json({ serviceOrder: existing, created: false })

    const { data: serviceOrder, error: createError } = await admin
      .from('service_orders')
      .insert({
        listing_id: listing.id,
        lead_id: lead.id,
        buyer_id: lead.visitor_id,
        seller_id: lead.owner_id,
        status: 'requested',
      })
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at,created_at,updated_at')
      .single()
    if (createError) throw createError

    return NextResponse.json({ serviceOrder, created: true }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xizmat kelishuvini boshlashda xatolik.' }, { status: 500 })
  }
}
