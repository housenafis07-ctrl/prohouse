import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const productCode = typeof body.productCode === 'string' ? body.productCode.trim() : ''
    const listingId = typeof body.listingId === 'string' && body.listingId.trim() ? body.listingId.trim() : null
    const quantity = Number.isInteger(body.quantity) ? body.quantity : 1
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 128)
      : crypto.randomUUID()

    if (!productCode) return NextResponse.json({ error: 'PRODUCT_REQUIRED' }, { status: 400 })
    if (quantity < 1 || quantity > 100) return NextResponse.json({ error: 'INVALID_QUANTITY' }, { status: 400 })

    const { data: orderId, error: orderError } = await supabase.rpc('create_monetization_order', {
      p_product_code: productCode,
      p_listing_id: listingId,
      p_quantity: quantity,
      p_idempotency_key: idempotencyKey,
    })
    if (orderError) {
      const status = /PRODUCT_NOT_AVAILABLE|PRODUCT_NOT_ALLOWED|LISTING_NOT_OWNED|LISTING_NOT_PURCHASABLE/.test(orderError.message) ? 400 : 500
      return NextResponse.json({ error: orderError.message }, { status })
    }

    const admin = serviceClient()
    const { data: order, error: fetchError } = await admin.from('monetization_orders')
      .select('id,status,subtotal_uzs,currency,provider,provider_order_id,idempotency_key,created_at,updated_at')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })

    return NextResponse.json({
      order,
      payment: { status: order.status, provider: order.provider === 'unconfigured' ? null : order.provider },
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ORDER_CREATE_FAILED' }, { status: 500 })
  }
}
