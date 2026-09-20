import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

const CLICK_OK = 0
const CLICK_SIGN_FAILED = -1
const CLICK_INVALID_AMOUNT = -2
const CLICK_ACTION_NOT_FOUND = -3
const CLICK_ALREADY_PAID = -4
const CLICK_ORDER_NOT_FOUND = -5
const CLICK_TRANSACTION_NOT_FOUND = -6
const CLICK_UPDATE_FAILED = -7
const CLICK_REQUEST_ERROR = -8
const CLICK_CANCELLED = -9

function md5(value: string) {
  return createHash('md5').update(value, 'utf8').digest('hex')
}

function sameHex(a: string, b: string) {
  const left = Buffer.from(a.toLowerCase(), 'utf8')
  const right = Buffer.from(b.toLowerCase(), 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

function signatureBase(params: URLSearchParams, secretKey: string) {
  const clickTransId = params.get('click_trans_id') || ''
  const serviceId = params.get('service_id') || ''
  const merchantTransId = params.get('merchant_trans_id') || ''
  const merchantPrepareId = params.get('merchant_prepare_id') || ''
  const amount = params.get('amount') || ''
  const action = params.get('action') || ''
  const signTime = params.get('sign_time') || ''

  return action === '0'
    ? `${clickTransId}${serviceId}${secretKey}${merchantTransId}${amount}${action}${signTime}`
    : `${clickTransId}${serviceId}${secretKey}${merchantTransId}${merchantPrepareId}${amount}${action}${signTime}`
}

function response(params: URLSearchParams, error: number, errorNote: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    click_trans_id: Number(params.get('click_trans_id') || 0),
    merchant_trans_id: params.get('merchant_trans_id') || '',
    error,
    error_note: errorNote,
    ...extra,
  })
}

export async function POST(request: NextRequest) {
  const serviceId = process.env.CLICK_SERVICE_ID
  const secretKey = process.env.CLICK_SECRET_KEY
  if (!serviceId || !secretKey) return NextResponse.json({ error: 'CLICK_NOT_CONFIGURED' }, { status: 503 })

  try {
    const raw = await request.text()
    const params = new URLSearchParams(raw)
    const action = params.get('action')
    const signString = params.get('sign_string') || ''
    const clickTransId = params.get('click_trans_id') || ''
    const requestServiceId = params.get('service_id') || ''
    const merchantTransId = params.get('merchant_trans_id') || ''
    const amountRaw = params.get('amount') || ''
    const signTime = params.get('sign_time') || ''

    if (!clickTransId || !requestServiceId || !merchantTransId || !amountRaw || !action || !signTime || !signString) {
      return response(params, CLICK_REQUEST_ERROR, 'Invalid request')
    }
    if (requestServiceId !== serviceId) return response(params, CLICK_SIGN_FAILED, 'SIGN CHECK FAILED!')
    if (action !== '0' && action !== '1') return response(params, CLICK_ACTION_NOT_FOUND, 'Action not found')

    const expected = md5(signatureBase(params, secretKey))
    if (!sameHex(signString, expected)) return response(params, CLICK_SIGN_FAILED, 'SIGN CHECK FAILED!')

    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) return response(params, CLICK_INVALID_AMOUNT, 'Incorrect amount')

    const admin = serviceClient()
    const { data: attempt, error: lookupError } = await admin.from('monetization_payment_attempts')
      .select('id,order_id,provider,status,amount_uzs,currency,provider_payment_id,provider_prepare_id,provider_paydoc_id')
      .eq('id', merchantTransId)
      .eq('provider', 'click')
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!attempt) return response(params, CLICK_ORDER_NOT_FOUND, 'User does not exist')

    if (Number(attempt.amount_uzs) !== amount || attempt.currency !== 'UZS') {
      return response(params, CLICK_INVALID_AMOUNT, 'Incorrect amount')
    }

    const clickPaymentId = params.get('click_paydoc_id')
    const clickPrepareId = params.get('merchant_prepare_id')
    const clickPaymentIdValue = clickPaymentId && /^\d+$/.test(clickPaymentId) ? Number(clickPaymentId) : null
    const prepareIdValue = clickPrepareId && /^\d+$/.test(clickPrepareId) ? Number(clickPrepareId) : null

    if (action === '0') {
      if (attempt.status === 'paid') return response(params, CLICK_ALREADY_PAID, 'Already paid')
      if (attempt.provider_payment_id && attempt.provider_payment_id !== clickTransId) {
        return response(params, CLICK_UPDATE_FAILED, 'Payment transaction mismatch')
      }

      const prepareId = attempt.provider_prepare_id ?? (await admin.rpc('nextval', { sequence_name: 'monetization_click_prepare_seq' }).then(() => null))
      if (!prepareId) {
        const { data: seqRow, error: seqError } = await admin.from('monetization_payment_attempts').select('provider_prepare_id').eq('id', attempt.id).maybeSingle()
        if (seqError) throw seqError
        if (!seqRow?.provider_prepare_id) return response(params, CLICK_UPDATE_FAILED, 'Could not allocate prepare id')
      }
      const finalPrepareId = prepareId ?? attempt.provider_prepare_id

      const { error: updateError } = await admin.from('monetization_payment_attempts').update({
        status: 'processing',
        provider_payment_id: clickTransId,
        provider_paydoc_id: clickPaymentIdValue,
        provider_prepare_id: finalPrepareId,
        provider_payload: Object.fromEntries(params.entries()),
        updated_at: new Date().toISOString(),
      }).eq('id', attempt.id)
      if (updateError) throw updateError

      return response(params, CLICK_OK, 'Success', { merchant_prepare_id: finalPrepareId })
    }

    if (!prepareIdValue || attempt.provider_prepare_id !== prepareIdValue) {
      return response(params, CLICK_TRANSACTION_NOT_FOUND, 'Transaction not found')
    }
    if (attempt.provider_payment_id && attempt.provider_payment_id !== clickTransId) {
      return response(params, CLICK_UPDATE_FAILED, 'Payment transaction mismatch')
    }

    if (attempt.status === 'paid') {
      return response(params, CLICK_ALREADY_PAID, 'Already paid', { merchant_confirm_id: attempt.provider_prepare_id })
    }

    if (params.get('error') !== '0') {
      const cancelled = params.get('error') === '-9'
      await admin.from('monetization_payment_attempts').update({
        status: cancelled ? 'cancelled' : 'failed',
        provider_payment_id: clickTransId,
        provider_paydoc_id: clickPaymentIdValue,
        provider_payload: Object.fromEntries(params.entries()),
        updated_at: new Date().toISOString(),
      }).eq('id', attempt.id)
      return response(params, CLICK_OK, 'Success', { merchant_confirm_id: attempt.provider_prepare_id })
    }

    const { error: attemptUpdateError } = await admin.from('monetization_payment_attempts').update({
      status: 'paid',
      provider_payment_id: clickTransId,
      provider_paydoc_id: clickPaymentIdValue,
      provider_payload: Object.fromEntries(params.entries()),
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).neq('status', 'paid')
    if (attemptUpdateError) throw attemptUpdateError

    const { error: orderUpdateError } = await admin.from('monetization_orders').update({
      status: 'paid',
      provider: 'click',
      provider_order_id: clickTransId,
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.order_id).neq('status', 'paid')
    if (orderUpdateError) throw orderUpdateError

    const { error: activationError } = await admin.rpc('activate_monetization_order', { p_order_id: attempt.order_id })
    if (activationError) throw activationError

    return response(params, CLICK_OK, 'Success', { merchant_confirm_id: attempt.provider_prepare_id })
  } catch (error) {
    console.error('Click webhook failed', error)
    return NextResponse.json({ error: CLICK_UPDATE_FAILED, error_note: 'Failed to update transaction' }, { status: 200 })
  }
}
