import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

type RpcRequest = {
  method?: string
  params?: Record<string, unknown>
  id?: number | string | null
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result }, { status: 200 })
}

function rpcError(id: RpcRequest['id'], code: number, message: string, data?: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }, { status: 200 })
}

function constantTimeEqual(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return require('node:crypto').timingSafeEqual(aa, bb)
}

function authorized(request: NextRequest) {
  const configured = process.env.PAYME_MERCHANT_KEY
  if (!configured) return false
  const header = request.headers.get('authorization') || ''
  if (!header.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8')
  } catch {
    return false
  }
  const separator = decoded.indexOf(':')
  if (separator < 0) return false
  const username = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)
  return username === 'Paycom' && constantTimeEqual(password, configured)
}

function errorCode(message: string) {
  if (message === 'TRANSACTION_NOT_FOUND') return -31003
  if (message === 'AMOUNT_MISMATCH') return -31001
  if (message === 'TRANSACTION_NOT_ALLOWED') return -31008
  if (message === 'ORDER_NOT_FOUND') return -31050
  return -32400
}

export async function POST(request: NextRequest) {
  if (!process.env.PAYME_MERCHANT_KEY) return rpcError(null, -32400, 'Payme is not configured')
  if (!authorized(request)) return rpcError(null, -32504, 'Insufficient privileges')

  let body: RpcRequest
  try {
    body = await request.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const method = typeof body.method === 'string' ? body.method : ''
  const params = body.params || {}
  const admin = serviceClient()

  try {
    if (method === 'CheckPerformTransaction') {
      const amount = Number(params.amount)
      const account = params.account as Record<string, unknown> | undefined
      const orderId = typeof account?.order_id === 'string' ? account.order_id : ''
      if (!orderId) return rpcError(body.id, -31050, 'Invalid account', 'order_id')
      const { data: order, error } = await admin.from('monetization_orders')
        .select('id,status,subtotal_uzs,currency')
        .eq('id', orderId)
        .maybeSingle()
      if (error) throw error
      if (!order) return rpcError(body.id, -31050, 'Order not found', 'order_id')
      if (order.currency !== 'UZS' || Math.round(Number(order.subtotal_uzs) * 100) !== amount) {
        return rpcError(body.id, -31001, 'Incorrect amount')
      }
      if (!['pending', 'awaiting_payment'].includes(order.status)) {
        return rpcError(body.id, -31008, 'Operation is not allowed')
      }
      return rpcResult(body.id, { allow: true })
    }

    if (method === 'CreateTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const time = Number(params.time)
      const amount = Number(params.amount)
      const account = params.account as Record<string, unknown> | undefined
      const orderId = typeof account?.order_id === 'string' ? account.order_id : ''
      if (!transactionId || !orderId || !Number.isFinite(time)) return rpcError(body.id, -31008, 'Operation is not allowed')

      const { data: order, error: orderError } = await admin.from('monetization_orders')
        .select('id,user_id,status,subtotal_uzs,currency')
        .eq('id', orderId)
        .maybeSingle()
      if (orderError) throw orderError
      if (!order) return rpcError(body.id, -31050, 'Order not found', 'order_id')
      if (order.currency !== 'UZS' || Math.round(Number(order.subtotal_uzs) * 100) !== amount) return rpcError(body.id, -31001, 'Incorrect amount')

      const { data: existing, error: existingError } = await admin.from('monetization_payment_attempts')
        .select('id,order_id,user_id,provider_payment_id,status,amount_uzs,provider_payload')
        .eq('provider', 'payme')
        .eq('provider_payment_id', transactionId)
        .maybeSingle()
      if (existingError) throw existingError
      if (existing) {
        const payload = (existing.provider_payload || {}) as Record<string, unknown>
        const payme = (payload.payme || {}) as Record<string, unknown>
        return rpcResult(body.id, {
          create_time: Number(payme.create_time || Date.now()),
          transaction: existing.id,
          state: existing.status === 'paid' ? 2 : existing.status === 'cancelled' ? -2 : 1,
        })
      }

      const { data: active, error: activeError } = await admin.from('monetization_payment_attempts')
        .select('id,status,provider_payment_id,provider_payload')
        .eq('provider', 'payme')
        .eq('order_id', orderId)
        .in('status', ['pending', 'processing', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (activeError) throw activeError
      if (active && active.provider_payment_id && active.provider_payment_id !== transactionId) {
        return rpcError(body.id, -31008, 'Operation is not allowed')
      }

      const createTime = Date.now()
      const { data: attempt, error: insertError } = await admin.from('monetization_payment_attempts')
        .insert({
          order_id: order.id,
          user_id: order.user_id,
          provider: 'payme',
          provider_payment_id: transactionId,
          status: 'processing',
          amount_uzs: order.subtotal_uzs,
          currency: order.currency,
          idempotency_key: `payme:${transactionId}`,
          provider_payload: { payme: { id: transactionId, time, amount, account, create_time: createTime, state: 1 } },
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      return rpcResult(body.id, { create_time: createTime, transaction: attempt.id, state: 1 })
    }

    if (method === 'PerformTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      if (!transactionId) return rpcError(body.id, -31003, 'Transaction not found')
      const { data: attempt, error } = await admin.from('monetization_payment_attempts')
        .select('id,order_id,status,provider_payment_id,provider_payload')
        .eq('provider', 'payme')
        .eq('provider_payment_id', transactionId)
        .maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      if (attempt.status === 'paid') {
        const payload = (attempt.provider_payload || {}) as Record<string, unknown>
        const payme = (payload.payme || {}) as Record<string, unknown>
        return rpcResult(body.id, { transaction: attempt.id, perform_time: Number(payme.perform_time || Date.now()), state: 2 })
      }
      if (attempt.status !== 'processing') return rpcError(body.id, -31008, 'Operation is not allowed')

      const performTime = Date.now()
      const payload = (attempt.provider_payload || {}) as Record<string, unknown>
      const payme = (payload.payme || {}) as Record<string, unknown>
      const nextPayload = { ...payload, payme: { ...payme, perform_time: performTime, state: 2 } }
      const { error: updateError } = await admin.from('monetization_payment_attempts')
        .update({ status: 'paid', paid_at: new Date().toISOString(), provider_payload: nextPayload, updated_at: new Date().toISOString() })
        .eq('id', attempt.id)
        .eq('status', 'processing')
      if (updateError) throw updateError

      const { error: orderError } = await admin.from('monetization_orders')
        .update({ status: 'paid', provider: 'payme', provider_order_id: transactionId, updated_at: new Date().toISOString() })
        .eq('id', attempt.order_id)
        .in('status', ['pending', 'awaiting_payment'])
      if (orderError) throw orderError

      const { error: activationError } = await admin.rpc('activate_monetization_order', { p_order_id: attempt.order_id })
      if (activationError) throw activationError

      return rpcResult(body.id, { transaction: attempt.id, perform_time: performTime, state: 2 })
    }

    if (method === 'CancelTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const cancelState = Number(params.reason) === undefined ? -1 : -2
      const { data: attempt, error } = await admin.from('monetization_payment_attempts')
        .select('id,order_id,status,provider_payload')
        .eq('provider', 'payme')
        .eq('provider_payment_id', transactionId)
        .maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      if (attempt.status === 'paid') {
        const payload = (attempt.provider_payload || {}) as Record<string, unknown>
        const payme = (payload.payme || {}) as Record<string, unknown>
        const performTime = Number(payme.perform_time || 0)
        if (performTime && cancelState === -2) {
          return rpcError(body.id, -31008, 'Operation is not allowed')
        }
      }
      const state = cancelState === -2 ? -2 : -1
      const nextPayload = { ...((attempt.provider_payload || {}) as Record<string, unknown>), payme: { ...(((attempt.provider_payload || {}) as Record<string, unknown>).payme || {}), cancel_reason: params.reason, cancel_time: Date.now(), state } }
      const { error: updateError } = await admin.from('monetization_payment_attempts')
        .update({ status: 'cancelled', provider_payload: nextPayload, updated_at: new Date().toISOString() })
        .eq('id', attempt.id)
      if (updateError) throw updateError
      return rpcResult(body.id, { transaction: attempt.id, cancel_time: Date.now(), state })
    }

    if (method === 'CheckTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const { data: attempt, error } = await admin.from('monetization_payment_attempts')
        .select('id,status,provider_payload,created_at')
        .eq('provider', 'payme')
        .eq('provider_payment_id', transactionId)
        .maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      const payload = (attempt.provider_payload || {}) as Record<string, unknown>
      const payme = (payload.payme || {}) as Record<string, unknown>
      const state = attempt.status === 'paid' ? 2 : attempt.status === 'cancelled' ? -2 : 1
      return rpcResult(body.id, {
        create_time: Number(payme.create_time || new Date(attempt.created_at).getTime()),
        perform_time: Number(payme.perform_time || 0),
        cancel_time: Number(payme.cancel_time || 0),
        transaction: attempt.id,
        state,
        reason: payme.cancel_reason ?? null,
      })
    }

    return rpcError(body.id, -32601, 'Method not found')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payme merchant error'
    return rpcError(body.id, errorCode(message), message)
  }
}
