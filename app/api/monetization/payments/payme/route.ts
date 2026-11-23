import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

function getSiteUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
}

function buildPaymeCheckoutUrl(params: Record<string, string>) {
  // Payme GET checkout format: base64(m=...;ac.order_id=...;a=...;...)
  const raw = Object.entries(params).map(([key, value]) => `${key}=${value}`).join(';')
  return `https://checkout.paycom.uz/${Buffer.from(raw, 'utf8').toString('base64')}`
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

    const merchantId = process.env.PAYME_MERCHANT_ID?.trim()
    if (!merchantId) return NextResponse.json({ error: 'PAYME_NOT_CONFIGURED' }, { status: 503 })

    const { data: attemptRow, error: attemptError } = await supabase.rpc('create_monetization_payment_attempt', {
      p_order_id: orderId,
      p_provider: 'payme',
      p_idempotency_key: idempotencyKey,
    })

    if (attemptError) {
      const status = /ORDER_NOT_FOUND|ORDER_NOT_PAYABLE|AUTH_REQUIRED|ORDER_NOT_FOUND|ORDER_NOT_PAYABLE|AUTH_REQUIRED|UNSUPPORTED_PAYMENT_PROVIDER|PAYMENT_PROVIDER_MISMATCH/.test(attemptError.message) ? 400 : 500
      return NextResponse.json({ error: attemptError.message }, { status })
    }

    const attemptId = attemptRow && typeof attemptRow === 'object' && 'id' in attemptRow ? String((attemptRow as { id: string }).id) : ''
    if (!attemptId) return NextResponse.json({ error: 'PAYMENT_ATTEMPT_ID_MISSING' }, { status: 500 })

    const admin = serviceClient()
    const { data: attempt, error: fetchError } = await admin
      .from('monetization_payment_attempts')
      .select('id,order_id,user_id,provider,status,amount_uzs,currency,checkout_url,provider_payment_id')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('[Payme checkout] Failed to load payment attempt', {
        attemptId: String(attemptId),
        orderId,
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
      })
      throw new Error('PAYME_ATTEMPT_FETCH_FAILED')
    }
    if (!attempt) return NextResponse.json({ error: 'PAYMENT_ATTEMPT_NOT_FOUND' }, { status: 404 })

    if (attempt.currency !== 'UZS' || Number(attempt.amount_uzs) <= 0) {
      return NextResponse.json({ error: 'INVALID_PAYMENT_AMOUNT' }, { status: 400 })
    }

    const amountTiyin = Math.round(Number(attempt.amount_uzs) * 100)
    const siteUrl = getSiteUrl(request)
    const callback = `${siteUrl}/account/monetization/checkout?orderId=${encodeURIComponent(attempt.order_id)}&transaction=:transaction`

    const checkoutUrl = buildPaymeCheckoutUrl({
      m: merchantId,
      'ac.order_id': attempt.order_id,
      a: String(amountTiyin),
      l: 'uz',
      c: callback,
      ct: '15000',
      cr: '860',
    })

    if (attempt.checkout_url !== checkoutUrl) {
      const { error: updateError } = await admin
        .from('monetization_payment_attempts')
        .update({
          checkout_url: checkoutUrl,
          provider_payload: {
            mode: 'hosted_checkout_get',
            merchant_id: merchantId,
            amount_tiyin: amountTiyin,
            callback,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', attempt.id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[Payme checkout] Failed to persist checkout metadata', {
          attemptId: attempt.id,
          orderId: attempt.order_id,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        })
        // Do not redirect until checkout metadata persistence is confirmed. The
        // callback still binds to the pending attempt; returning a generic error
        // here avoids exposing database details while logs preserve the root cause.
        throw new Error('PAYME_CHECKOUT_METADATA_SAVE_FAILED')
      }
    }

    return NextResponse.json({
      attempt: { ...attempt, checkout_url: checkoutUrl },
      checkoutUrl,
      amountTiyin,
    })
  } catch (e) {
    if (e instanceof Error) {
      console.error('[Payme checkout] Request failed', { message: e.message })
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    // Some SDK/network layers can reject with a plain object rather than Error.
    // Preserve only safe diagnostic fields and expose its message when available,
    // so the checkout UI does not hide the actionable failure behind a generic code.
    const unknownError = e && typeof e === 'object' ? e as Record<string, unknown> : null
    const message = typeof unknownError?.message === 'string'
      ? unknownError.message
      : typeof e === 'string'
        ? e
        : 'PAYME_CHECKOUT_FAILED'
    console.error('[Payme checkout] Request failed with non-Error value', {
      message,
      name: typeof unknownError?.name === 'string' ? unknownError.name : undefined,
      code: typeof unknownError?.code === 'string' ? unknownError.code : undefined,
      details: typeof unknownError?.details === 'string' ? unknownError.details : undefined,
      hint: typeof unknownError?.hint === 'string' ? unknownError.hint : undefined,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
