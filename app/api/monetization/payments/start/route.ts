import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json()
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const configuredProvider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || ''

    if (!orderId) return NextResponse.json({ error: 'ORDER_REQUIRED' }, { status: 400 })
    if (!configuredProvider) {
      return NextResponse.json({
        error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        orderId,
        payment: { status: 'not_configured' },
      }, { status: 503 })
    }

    const { data: attempt, error } = await supabase.rpc('create_monetization_payment_attempt', {
      p_order_id: orderId,
      p_provider: configuredProvider,
    })
    if (error) {
      const status = /ORDER_NOT_FOUND|ORDER_NOT_PAYABLE|INVALID_PAYMENT_PROVIDER/.test(error.message) ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        orderId: attempt.order_id,
        provider: attempt.provider,
        status: attempt.status,
        amountUzs: attempt.amount_uzs,
        currency: attempt.currency,
        checkoutUrl: attempt.checkout_url,
      },
      payment: { status: 'created', provider: attempt.provider },
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PAYMENT_START_FAILED' }, { status: 500 })
  }
}
