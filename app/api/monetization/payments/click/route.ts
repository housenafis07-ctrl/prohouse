import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

function getSiteUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 128)
      : crypto.randomUUID()
    if (!orderId) return NextResponse.json({ error: 'ORDER_REQUIRED' }, { status: 400 })

    const serviceId = process.env.CLICK_SERVICE_ID
    const merchantId = process.env.CLICK_MERCHANT_ID
    if (!serviceId || !merchantId) {
      return NextResponse.json({ error: 'CLICK_NOT_CONFIGURED' }, { status: 503 })
    }

    const { data: attemptId, error: attemptError } = await supabase.rpc('create_monetization_payment_attempt', {
      p_order_id: orderId,
      p_provider: 'click',
      p_idempotency_key: idempotencyKey,
    })
    if (attemptError) {
      const status = /ORDER_NOT_FOUND|ORDER_NOT_PAYABLE|AUTH_REQUIRED/.test(attemptError.message) ? 400 : 500
      return NextResponse.json({ error: attemptError.message }, { status })
    }

    const admin = serviceClient()
    const { data: attempt, error: fetchError } = await admin.from('monetization_payment_attempts')
      .select('id,order_id,user_id,provider,provider_prepare_id,status,amount_uzs,currency,checkout_url')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!attempt) return NextResponse.json({ error: 'PAYMENT_ATTEMPT_NOT_FOUND' }, { status: 404 })

    if (attempt.checkout_url) {
      return NextResponse.json({ attempt, checkoutUrl: attempt.checkout_url })
    }

    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_id: merchantId,
      amount: String(attempt.amount_uzs),
      transaction_param: attempt.id,
      return_url: `${getSiteUrl(request)}/account/monetization/checkout?orderId=${encodeURIComponent(attempt.order_id)}`,
    })
    const checkoutUrl = `https://my.click.uz/services/pay?${params.toString()}`

    const { error: updateError } = await admin.from('monetization_payment_attempts')
      .update({ checkout_url: checkoutUrl, provider_payload: { mode: 'hosted_checkout', provider_prepare_id: attempt.provider_prepare_id } })
      .eq('id', attempt.id)
      .eq('user_id', user.id)
    if (updateError) throw updateError

    return NextResponse.json({ attempt: { ...attempt, checkout_url: checkoutUrl }, checkoutUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'CLICK_CHECKOUT_FAILED' }, { status: 500 })
  }
}
