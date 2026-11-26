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

function numericId(value: string | null) {
  return value && /^\d+$/.test(value) ? Number(value) : null
}

async function allocatePrepareId(admin: ReturnType<typeof serviceClient>) {
  const { data, error } = await admin.rpc('allocate_click_prepare_id')
  if (error || !data || !Number.isSafeInteger(Number(data))) throw error || new Error('CLICK_PREPARE_ID_ALLOCATION_FAILED')
  return Number(data)
}

async function handleMonetization(admin: ReturnType<typeof serviceClient>, params: URLSearchParams, attempt: any, action: string, amount: number) {
  const clickTransId = params.get('click_trans_id') || ''
  const clickPaydocId = numericId(params.get('click_paydoc_id'))
  const receivedPrepareId = numericId(params.get('merchant_prepare_id'))
  if (Number(attempt.amount_uzs) !== amount || attempt.currency !== 'UZS') {
    return response(params, CLICK_INVALID_AMOUNT, 'Incorrect amount')
  }
  if (attempt.provider_payment_id && attempt.provider_payment_id !== clickTransId) {
    return response(params, CLICK_UPDATE_FAILED, 'Payment transaction mismatch')
  }

  if (action === '0') {
    if (attempt.status === 'paid') return response(params, CLICK_ALREADY_PAID, 'Already paid')
    if (attempt.status === 'processing' && attempt.provider_prepare_id && attempt.provider_payment_id === clickTransId) {
      return response(params, CLICK_OK, 'Success', { merchant_prepare_id: attempt.provider_prepare_id })
    }
    if (!['pending', 'processing'].includes(attempt.status)) {
      return response(params, CLICK_ORDER_NOT_FOUND, 'Order is not payable')
    }
    const prepareId = attempt.provider_prepare_id || await allocatePrepareId(admin)
    const { data: updated, error } = await admin.from('monetization_payment_attempts').update({
      status: 'processing',
      provider_payment_id: clickTransId,
      provider_paydoc_id: clickPaydocId,
      provider_prepare_id: prepareId,
      provider_payload: { ...((attempt.provider_payload || {}) as Record<string, unknown>), click: Object.fromEntries(params.entries()) },
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).in('status', ['pending', 'processing']).is('provider_payment_id', attempt.provider_payment_id || null).select('id').maybeSingle()
    if (error) throw error
    if (!updated) {
      const { data: latest, error: reloadError } = await admin.from('monetization_payment_attempts')
        .select('status,provider_payment_id,provider_prepare_id').eq('id', attempt.id).maybeSingle()
      if (reloadError) throw reloadError
      if (latest?.status === 'processing' && latest.provider_payment_id === clickTransId && latest.provider_prepare_id) {
        return response(params, CLICK_OK, 'Success', { merchant_prepare_id: latest.provider_prepare_id })
      }
      return response(params, CLICK_UPDATE_FAILED, 'Payment transaction mismatch')
    }
    return response(params, CLICK_OK, 'Success', { merchant_prepare_id: prepareId })
  }

  if (!receivedPrepareId || Number(attempt.provider_prepare_id) !== receivedPrepareId) {
    return response(params, CLICK_TRANSACTION_NOT_FOUND, 'Transaction not found')
  }
  if (attempt.status === 'paid') {
    return response(params, CLICK_ALREADY_PAID, 'Already paid', { merchant_confirm_id: attempt.provider_prepare_id })
  }
  if (params.get('error') !== '0') {
    const cancelled = params.get('error') === '-9'
    const { error } = await admin.from('monetization_payment_attempts').update({
      status: cancelled ? 'cancelled' : 'failed',
      provider_payment_id: clickTransId,
      provider_paydoc_id: clickPaydocId,
      provider_payload: { ...((attempt.provider_payload || {}) as Record<string, unknown>), click: Object.fromEntries(params.entries()) },
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).eq('status', 'processing')
    if (error) throw error
    return response(params, CLICK_OK, 'Success', { merchant_confirm_id: receivedPrepareId })
  }
  const { data, error } = await admin.rpc('complete_click_monetization_payment', {
    p_attempt_id: attempt.id,
    p_click_trans_id: clickTransId,
    p_click_paydoc_id: clickPaydocId,
    p_amount_uzs: amount,
    p_click_payload: Object.fromEntries(params.entries()),
  })
  if (error) throw error
  if (!data?.paid) return response(params, CLICK_UPDATE_FAILED, 'Payment could not be completed')
  return response(params, CLICK_OK, 'Success', { merchant_confirm_id: receivedPrepareId })
}

async function handleRental(admin: ReturnType<typeof serviceClient>, params: URLSearchParams, booking: any, action: string, amount: number) {
  const clickTransId = params.get('click_trans_id') || ''
  const clickPaydocId = numericId(params.get('click_paydoc_id'))
  const receivedPrepareId = numericId(params.get('merchant_prepare_id'))
  if (booking.payment_provider !== 'click' || booking.currency !== 'UZS' || Math.round(Number(booking.deposit_amount)) !== amount) {
    return response(params, CLICK_INVALID_AMOUNT, 'Incorrect amount')
  }
  const prior = (booking.provider_payload || {}) as Record<string, any>
  const priorClick = prior.click || {}
  if (booking.provider_payment_id && booking.provider_payment_id !== clickTransId) {
    return response(params, CLICK_UPDATE_FAILED, 'Payment transaction mismatch')
  }

  if (action === '0') {
    if (booking.payment_status === 'paid') return response(params, CLICK_ALREADY_PAID, 'Already paid')
    if (booking.payment_status === 'processing' && booking.provider_payment_id === clickTransId && priorClick.prepare_id) {
      return response(params, CLICK_OK, 'Success', { merchant_prepare_id: priorClick.prepare_id })
    }
    if (booking.status !== 'pending_payment' || booking.payment_status !== 'pending' ||
        (booking.payment_expires_at && new Date(booking.payment_expires_at).getTime() <= Date.now())) {
      return response(params, CLICK_ORDER_NOT_FOUND, 'Booking is not payable')
    }
    const prepareId = await allocatePrepareId(admin)
    const nextPayload = { ...prior, click: { ...Object.fromEntries(params.entries()), prepare_id: prepareId } }
    const { data: updated, error } = await admin.from('rental_bookings').update({
      payment_status: 'processing',
      provider_payment_id: clickTransId,
      provider_payload: nextPayload,
      payment_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', booking.id).eq('payment_status', 'pending').is('provider_payment_id', null).select('id').maybeSingle()
    if (error) throw error
    if (!updated) {
      const { data: latest, error: reloadError } = await admin.from('rental_bookings')
        .select('payment_status,provider_payment_id,provider_payload').eq('id', booking.id).maybeSingle()
      if (reloadError) throw reloadError
      const latestClick = ((latest?.provider_payload || {}) as Record<string, any>).click || {}
      if (latest?.payment_status === 'processing' && latest.provider_payment_id === clickTransId && latestClick.prepare_id) {
        return response(params, CLICK_OK, 'Success', { merchant_prepare_id: latestClick.prepare_id })
      }
      return response(params, CLICK_UPDATE_FAILED, 'Booking payment is already in progress')
    }
    return response(params, CLICK_OK, 'Success', { merchant_prepare_id: prepareId })
  }

  if (!receivedPrepareId || Number(priorClick.prepare_id) !== receivedPrepareId) {
    return response(params, CLICK_TRANSACTION_NOT_FOUND, 'Transaction not found')
  }
  if (booking.payment_status === 'paid') {
    return response(params, CLICK_ALREADY_PAID, 'Already paid', { merchant_confirm_id: receivedPrepareId })
  }
  if (params.get('error') !== '0') {
    const { error } = await admin.from('rental_bookings').update({
      payment_status: 'cancelled',
      status: 'cancelled',
      provider_payload: { ...prior, click: { ...priorClick, ...Object.fromEntries(params.entries()) } },
      updated_at: new Date().toISOString(),
    }).eq('id', booking.id).eq('payment_status', 'processing')
    if (error) throw error
    return response(params, CLICK_OK, 'Success', { merchant_confirm_id: receivedPrepareId })
  }
  const { data, error } = await admin.rpc('complete_click_rental_payment', {
    p_booking_id: booking.id,
    p_click_trans_id: clickTransId,
    p_click_paydoc_id: clickPaydocId,
    p_amount_uzs: amount,
    p_click_payload: Object.fromEntries(params.entries()),
  })
  if (error) throw error
  if (!data?.paid) return response(params, CLICK_UPDATE_FAILED, 'Booking payment could not be completed')
  return response(params, CLICK_OK, 'Success', { merchant_confirm_id: receivedPrepareId })
}

export async function POST(request: NextRequest) {
  const serviceId = process.env.CLICK_SERVICE_ID
  const secretKey = process.env.CLICK_SECRET_KEY
  if (!serviceId || !secretKey) return NextResponse.json({ error: 'CLICK_NOT_CONFIGURED' }, { status: 503 })

  try {
    const params = new URLSearchParams(await request.text())
    const action = params.get('action') || ''
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
    if (!sameHex(signString, md5(signatureBase(params, secretKey)))) {
      return response(params, CLICK_SIGN_FAILED, 'SIGN CHECK FAILED!')
    }
    const amount = Number(amountRaw)
    if (!Number.isSafeInteger(amount) || amount <= 0) return response(params, CLICK_INVALID_AMOUNT, 'Incorrect amount')

    const admin = serviceClient()
    const { data: attempt, error: attemptError } = await admin.from('monetization_payment_attempts')
      .select('id,order_id,provider,status,amount_uzs,currency,provider_payment_id,provider_prepare_id,provider_paydoc_id,provider_payload')
      .eq('id', merchantTransId).eq('provider', 'click').maybeSingle()
    if (attemptError) throw attemptError
    if (attempt) return await handleMonetization(admin, params, attempt, action, amount)

    const { data: booking, error: bookingError } = await admin.from('rental_bookings')
      .select('id,payment_provider,payment_status,status,deposit_amount,currency,provider_payment_id,provider_payload,payment_expires_at')
      .eq('id', merchantTransId).maybeSingle()
    if (bookingError) throw bookingError
    if (!booking || booking.payment_provider !== 'click') return response(params, CLICK_ORDER_NOT_FOUND, 'Order not found')
    return await handleRental(admin, params, booking, action, amount)
  } catch (error) {
    console.error('Click webhook failed', error)
    return NextResponse.json({ error: CLICK_UPDATE_FAILED, error_note: 'Failed to update transaction' }, { status: 200 })
  }
}
