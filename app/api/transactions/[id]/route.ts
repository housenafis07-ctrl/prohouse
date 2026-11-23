import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const allowedStatuses = new Set(['lead', 'viewing', 'offer', 'deal', 'payment', 'contract', 'cancelled'])

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

    const { id } = await params
    const { data: transaction, error } = await db
      .from('property_transactions')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,amount,currency,metadata,created_at,updated_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!transaction) return NextResponse.json({ error: 'Transaction topilmadi.' }, { status: 404 })
    if (transaction.buyer_id !== user.id && transaction.seller_id !== user.id) return NextResponse.json({ error: 'Ruxsat yo‘q.' }, { status: 403 })

    const { data: events, error: eventsError } = await db
      .from('property_transaction_events')
      .select('id,from_status,to_status,actor_id,note,metadata,created_at')
      .eq('transaction_id', id)
      .order('created_at', { ascending: true })
    if (eventsError) throw eventsError

    return NextResponse.json({ transaction, events: events ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Transactionni olishda xatolik.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => null)
    const toStatus = typeof body?.status === 'string' ? body.status : ''
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : null
    const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}

    if (!allowedStatuses.has(toStatus)) return NextResponse.json({ error: 'Noto‘g‘ri transaction status.' }, { status: 400 })

    const admin = serviceClient()
    const { data: transaction, error } = await admin.rpc('transition_property_transaction', {
      p_transaction_id: id,
      p_to_status: toStatus,
      p_actor_id: user.id,
      p_note: note,
      p_metadata: metadata,
    })

    if (error) {
      if (error.message.includes('TRANSACTION_NOT_FOUND')) return NextResponse.json({ error: 'Transaction topilmadi.' }, { status: 404 })
      if (error.message.includes('TRANSACTION_ACTOR_FORBIDDEN')) return NextResponse.json({ error: 'Amalni faqat tizimdagi foydalanuvchi bajarishi mumkin.' }, { status: 403 })
      if (error.message.includes('TRANSACTION_ROLE_FORBIDDEN')) return NextResponse.json({ error: 'Bu bosqichni navbati kelgan tomon bajaradi.' }, { status: 403 })
      if (error.message.includes('TRANSACTION_FORBIDDEN')) return NextResponse.json({ error: 'Bu transaction sizga tegishli emas.' }, { status: 403 })
      if (error.message.includes('INVALID_TRANSACTION_TRANSITION')) return NextResponse.json({ error: 'Bu statusga o‘tish mumkin emas.' }, { status: 409 })
      throw error
    }

    return NextResponse.json({ transaction: Array.isArray(transaction) ? transaction[0] : transaction })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Transaction statusini o‘zgartirib bo‘lmadi.' }, { status: 500 })
  }
}
