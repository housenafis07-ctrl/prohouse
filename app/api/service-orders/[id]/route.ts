import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const allowedActions = new Set(['agree', 'complete', 'cancel'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!allowedActions.has(action)) return NextResponse.json({ error: 'Noto‘g‘ri xizmat bosqichi.' }, { status: 400 })

    const admin = serviceClient()
    const { data: order, error: orderError } = await admin
      .from('service_orders')
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at')
      .eq('id', id)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return NextResponse.json({ error: 'Xizmat kelishuvi topilmadi.' }, { status: 404 })
    if (user.id !== order.buyer_id && user.id !== order.seller_id) return NextResponse.json({ error: 'Bu xizmat kelishuviga kirish huquqi yo‘q.' }, { status: 403 })

    if (action === 'cancel') {
      if (order.status === 'completed') return NextResponse.json({ error: 'Yakunlangan xizmatni bekor qilib bo‘lmaydi.' }, { status: 409 })
      const { data: updated, error } = await admin
        .from('service_orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at,created_at,updated_at')
        .single()
      if (error) throw error
      return NextResponse.json({ serviceOrder: updated })
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json({ error: 'Bu xizmat kelishuvi allaqachon yakunlangan.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {}

    if (action === 'agree') {
      if (order.status === 'agreed') return NextResponse.json({ error: 'Kelishuv allaqachon tasdiqlangan.' }, { status: 409 })
      if (user.id === order.buyer_id) update.buyer_agreed_at = order.buyer_agreed_at || now
      if (user.id === order.seller_id) update.seller_agreed_at = order.seller_agreed_at || now

      const buyerAgreed = Boolean(order.buyer_agreed_at || user.id === order.buyer_id)
      const sellerAgreed = Boolean(order.seller_agreed_at || user.id === order.seller_id)
      update.status = buyerAgreed && sellerAgreed ? 'agreed' : 'requested'
    }

    if (action === 'complete') {
      if (order.status !== 'agreed') return NextResponse.json({ error: 'Avval ikki tomon xizmat shartlariga kelishishi kerak.' }, { status: 409 })
      if (user.id === order.buyer_id) update.buyer_completed_at = order.buyer_completed_at || now
      if (user.id === order.seller_id) update.seller_completed_at = order.seller_completed_at || now

      const buyerCompleted = Boolean(order.buyer_completed_at || user.id === order.buyer_id)
      const sellerCompleted = Boolean(order.seller_completed_at || user.id === order.seller_id)
      update.status = buyerCompleted && sellerCompleted ? 'completed' : 'agreed'
    }

    const { data: updated, error: updateError } = await admin
      .from('service_orders')
      .update(update)
      .eq('id', id)
      .select('id,listing_id,lead_id,buyer_id,seller_id,status,buyer_agreed_at,seller_agreed_at,buyer_completed_at,seller_completed_at,created_at,updated_at')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ serviceOrder: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xizmat bosqichini o‘zgartirib bo‘lmadi.' }, { status: 500 })
  }
}
