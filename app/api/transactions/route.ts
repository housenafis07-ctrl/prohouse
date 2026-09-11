import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

    const { data, error } = await db
      .from('property_transactions')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,amount,currency,metadata,created_at,updated_at')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ transactions: data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Transactionlarni olishda xatolik.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Transaction yaratish uchun tizimga kiring.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const leadId = typeof body?.leadId === 'string' ? body.leadId : ''
    const amount = body?.amount == null || body.amount === '' ? null : Number(body.amount)
    const currency = typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'UZS'

    if (!leadId) return NextResponse.json({ error: 'leadId majburiy.' }, { status: 400 })
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return NextResponse.json({ error: 'amount noto‘g‘ri.' }, { status: 400 })

    const admin = serviceClient()
    const { data: lead, error: leadError } = await admin
      .from('listing_leads')
      .select('id,listing_id,owner_id,visitor_id,status,lead_type')
      .eq('id', leadId)
      .maybeSingle()
    if (leadError) throw leadError
    if (!lead) return NextResponse.json({ error: 'Lead topilmadi.' }, { status: 404 })
    if (lead.visitor_id !== user.id && lead.owner_id !== user.id) return NextResponse.json({ error: 'Bu lead sizga tegishli emas.' }, { status: 403 })
    if (!lead.visitor_id || lead.visitor_id === lead.owner_id) return NextResponse.json({ error: 'Transaction uchun xaridor va sotuvchi aniqlangan bo‘lishi kerak.' }, { status: 400 })

    const { data: existing, error: existingError } = await admin
      .from('property_transactions')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,amount,currency,metadata,created_at,updated_at')
      .eq('lead_id', lead.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) return NextResponse.json({ transaction: existing, created: false })

    const { data: transaction, error } = await admin
      .from('property_transactions')
      .insert({
        listing_id: lead.listing_id,
        lead_id: lead.id,
        buyer_id: lead.visitor_id,
        seller_id: lead.owner_id,
        status: 'lead',
        amount,
        currency,
      })
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,amount,currency,metadata,created_at,updated_at')
      .single()
    if (error) throw error

    const { error: eventError } = await admin.from('property_transaction_events').insert({
      transaction_id: transaction.id,
      from_status: null,
      to_status: 'lead',
      actor_id: user.id,
      note: 'Transaction yaratildi.',
    })
    if (eventError) throw eventError

    return NextResponse.json({ transaction, created: true }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Transaction yaratib bo‘lmadi.' }, { status: 500 })
  }
}
