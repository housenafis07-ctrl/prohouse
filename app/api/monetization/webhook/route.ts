import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'PAYMENT_WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  if (request.headers.get('x-prohouse-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'INVALID_WEBHOOK_SECRET' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    const status = body.status === 'paid' || body.status === 'failed' || body.status === 'cancelled' ? body.status : ''
    const providerPaymentId = typeof body.providerPaymentId === 'string' ? body.providerPaymentId : null
    const provider = typeof body.provider === 'string' ? body.provider : null
    if (!orderId || !status) return NextResponse.json({ error: 'INVALID_PAYMENT_EVENT' }, { status: 400 })

    const admin = serviceClient()
    const { data: order, error: orderError } = await admin.from('monetization_orders')
      .select('id,status').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })

    // Paid is terminal. A later failed/cancelled webhook must not downgrade it.
    if (order.status === 'paid') return NextResponse.json({ ok: true, alreadyPaid: true })

    const patch: Record<string, unknown> = {
      status,
      provider_payment_id: providerPaymentId,
      payment_provider: provider,
      updated_at: new Date().toISOString(),
    }
    if (status === 'paid') patch.paid_at = new Date().toISOString()

    const { error: updateError } = await admin.from('monetization_orders').update(patch).eq('id', order.id)
    if (updateError) throw updateError

    if (status === 'paid') {
      const { error: activationError } = await admin.rpc('activate_monetization_order', { p_order_id: order.id })
      if (activationError) throw activationError
    }

    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PAYMENT_WEBHOOK_FAILED' }, { status: 500 })
  }
}
