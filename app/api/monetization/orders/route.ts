import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const productId = typeof body.productId === 'string' ? body.productId : ''
    const listingId = typeof body.listingId === 'string' ? body.listingId : null
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 128)
      : crypto.randomUUID()
    if (!productId) return NextResponse.json({ error: 'PRODUCT_REQUIRED' }, { status: 400 })

    const admin = serviceClient()
    const { data: existing } = await admin.from('monetization_orders')
      .select('id,order_code,status,amount_uzs,currency,product_id,listing_id,created_at')
      .eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return NextResponse.json({ order: existing, reused: true })

    const { data: product, error: productError } = await admin.from('monetization_products')
      .select('id,code,name_uz,product_type,price_uzs,duration_days,quantity,is_active').eq('id', productId).eq('is_active', true).maybeSingle()
    if (productError) throw productError
    if (!product) return NextResponse.json({ error: 'PRODUCT_NOT_FOUND' }, { status: 404 })

    if (listingId) {
      const { data: listing } = await admin.from('listings').select('id,owner_id,status').eq('id', listingId).eq('owner_id', user.id).maybeSingle()
      if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 })
      if (!['active','moderation'].includes(listing.status)) return NextResponse.json({ error: 'LISTING_NOT_ELIGIBLE' }, { status: 400 })
    }

    const orderCode = `PH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`
    const { data: order, error } = await admin.from('monetization_orders').insert({
      order_code: orderCode, user_id: user.id, listing_id: listingId, product_id: product.id,
      amount_uzs: product.price_uzs, currency: 'UZS', status: 'pending',
      payment_provider: null, idempotency_key: idempotencyKey,
    }).select('id,order_code,status,amount_uzs,currency,product_id,listing_id,created_at').single()
    if (error) throw error
    return NextResponse.json({ order, payment: { status: 'pending', provider: null } }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ORDER_CREATE_FAILED' }, { status: 500 })
  }
}
