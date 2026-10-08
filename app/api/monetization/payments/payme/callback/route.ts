import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { serviceClient } from '@/utils/admin/auth'

type RpcRequest = {
  method?: string
  params?: Record<string, unknown>
  id?: number | string | null
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result }, { status: 200 })
}

function localizedMessage(code: number, message?: string) {
  const byMessage: Record<string, { ru: string; uz: string; en: string }> = {
    'Insufficient privileges': {
      ru: 'Недостаточно привилегий для выполнения метода',
      uz: 'Metodni bajarish uchun yetarli huquq yo‘q',
      en: 'Insufficient privileges to perform the method'
    },
    'Parse error': {
      ru: 'Ошибка разбора JSON',
      uz: 'JSONni tahlil qilishda xatolik',
      en: 'JSON parse error'
    },
    'Invalid params': {
      ru: 'Неверные параметры',
      uz: 'Noto‘g‘ri parametrlar',
      en: 'Invalid parameters'
    },
    'Method not found': {
      ru: 'Метод не найден',
      uz: 'Metod topilmadi',
      en: 'Method not found'
    },
    'Payme is not configured': {
      ru: 'Payme не настроен',
      uz: 'Payme sozlanmagan',
      en: 'Payme is not configured'
    },
    'Incorrect amount': {
      ru: 'Неверная сумма',
      uz: 'Noto‘g‘ri summa',
      en: 'Incorrect amount'
    },
    'Order not found': {
      ru: 'Номер заказа не найден',
      uz: 'Buyurtma raqami topilmadi',
      en: 'Order number not found'
    },
    'Operation is not allowed': {
      ru: 'Невозможно выполнить операцию',
      uz: 'Operatsiyani bajarib bo‘lmaydi',
      en: 'Unable to perform the operation'
    },
    'Other transaction for this order is in progress': {
      ru: 'По этому заказу уже выполняется другая транзакция',
      uz: 'Bu buyurtma uchun boshqa tranzaksiya allaqachon bajarilmoqda',
      en: 'Another transaction for this order is already in progress'
    },
    'Transaction not found': {
      ru: 'Транзакция не найдена',
      uz: 'Tranzaksiya topilmadi',
      en: 'Transaction not found'
    },
    'Order has already been completed': {
      ru: 'Заказ выполнен. Невозможно отменить транзакцию',
      uz: 'Buyurtma bajarilgan. Tranzaksiyani bekor qilib bo‘lmaydi',
      en: 'Order has already been completed. The transaction cannot be cancelled'
    },
    'Payme merchant error': {
      ru: 'Внутренняя ошибка мерчанта',
      uz: 'Merchant ichki xatosi',
      en: 'Internal merchant error'
    }
  }

  if (message && byMessage[message]) return byMessage[message]

  switch (code) {
    case -32300:
      return { ru: 'Метод запроса должен быть POST', uz: 'So‘rov metodi POST bo‘lishi kerak', en: 'Request method must be POST' }
    case -32600:
      return { ru: 'Неверный RPC-запрос', uz: 'RPC so‘rovi noto‘g‘ri', en: 'Invalid RPC request' }
    case -32601:
      return { ru: 'Метод не найден', uz: 'Metod topilmadi', en: 'Method not found' }
    case -32700:
      return { ru: 'Ошибка разбора JSON', uz: 'JSONni tahlil qilishda xatolik', en: 'JSON parse error' }
    case -32504:
      return { ru: 'Недостаточно привилегий для выполнения метода', uz: 'Metodni bajarish uchun yetarli huquq yo‘q', en: 'Insufficient privileges to perform the method' }
    case -32400:
      return { ru: 'Системная ошибка', uz: 'Tizim xatosi', en: 'System error' }
    case -31001:
      return { ru: 'Неверная сумма', uz: 'Noto‘g‘ri summa', en: 'Incorrect amount' }
    case -31003:
      return { ru: 'Транзакция не найдена', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' }
    case -31007:
      return { ru: 'Заказ выполнен. Невозможно отменить транзакцию', uz: 'Buyurtma bajarilgan. Tranzaksiyani bekor qilib bo‘lmaydi', en: 'Order has already been completed. The transaction cannot be cancelled' }
    case -31008:
      return { ru: 'Невозможно выполнить операцию', uz: 'Operatsiyani bajarib bo‘lmaydi', en: 'Unable to perform the operation' }
    case -31050:
      return { ru: 'Номер заказа не найден', uz: 'Buyurtma raqami topilmadi', en: 'Order number not found' }
    default:
      return { ru: 'Внутренняя ошибка мерчанта', uz: 'Merchant ichki xatosi', en: 'Internal merchant error' }
  }
}

function rpcError(id: RpcRequest['id'], code: number, message?: string, data?: unknown) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message: localizedMessage(code, message),
      ...(data === undefined ? {} : { data })
    }
  }, { status: 200 })
}

function constantTimeEqual(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return timingSafeEqual(aa, bb)
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
  // Supabase/Postgres can raise 22P02 when a malformed UUID reaches a UUID column.
  // Treat that as an invalid/non-existent order instead of exposing a generic
  // merchant error to Payme.
  if (message.includes('invalid input syntax for type uuid')) return -31050
  return -32400
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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
      if (!orderId || !isUuid(orderId)) return rpcError(body.id, -31050, 'Order not found', 'order_id')
      const { data: order, error } = await admin.from('monetization_orders').select('id,status,subtotal_uzs,currency').eq('id', orderId).maybeSingle()
      if (error) throw error
      if (!order) return rpcError(body.id, -31050, 'Order not found', 'order_id')
      if (order.currency !== 'UZS' || Math.round(Number(order.subtotal_uzs) * 100) !== amount) return rpcError(body.id, -31001, 'Incorrect amount')
      if (!['pending', 'awaiting_payment'].includes(order.status)) return rpcError(body.id, -31008, 'Operation is not allowed')
      return rpcResult(body.id, { allow: true })
    }

    if (method === 'CreateTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const time = Number(params.time)
      const amount = Number(params.amount)
      const account = params.account as Record<string, unknown> | undefined
      const orderId = typeof account?.order_id === 'string' ? account.order_id : ''
      if (!transactionId || !orderId || !Number.isFinite(time)) return rpcError(body.id, -31008, 'Operation is not allowed')
      if (!isUuid(orderId)) return rpcError(body.id, -31050, 'Order not found', 'order_id')

      const { data: order, error: orderError } = await admin.from('monetization_orders').select('id,user_id,status,subtotal_uzs,currency,provider').eq('id', orderId).maybeSingle()
      if (orderError) throw orderError
      if (!order) return rpcError(body.id, -31050, 'Order not found', 'order_id')
      if (order.currency !== 'UZS' || Math.round(Number(order.subtotal_uzs) * 100) !== amount) return rpcError(body.id, -31001, 'Incorrect amount')
      if (!['pending', 'awaiting_payment'].includes(order.status)) return rpcError(body.id, -31008, 'Operation is not allowed')
      if (order.provider && !['unconfigured', 'payme'].includes(order.provider)) return rpcError(body.id, -31008, 'Operation is not allowed')

      const { data: existing, error: existingError } = await admin.from('monetization_payment_attempts').select('id,order_id,user_id,provider_payment_id,status,amount_uzs,provider_payload').eq('provider', 'payme').eq('provider_payment_id', transactionId).maybeSingle()
      if (existingError) throw existingError
      if (existing) {
        const payload = (existing.provider_payload || {}) as Record<string, unknown>
        const payme = (payload.payme || {}) as Record<string, unknown>
        const originalAccount = (payme.account || {}) as Record<string, unknown>
        const originalOrderId = typeof originalAccount.order_id === 'string' ? originalAccount.order_id : ''
        const originalAmount = Number(payme.amount)

        // Payme retries CreateTransaction with the same transaction id only when
        // the request is identical. Never acknowledge a replay whose order or
        // amount differs from the transaction that was originally created.
        if (
          existing.order_id !== orderId ||
          originalOrderId !== orderId ||
          !Number.isFinite(originalAmount) ||
          originalAmount !== amount
        ) {
          return rpcError(body.id, -31001, 'Incorrect amount')
        }

        return rpcResult(body.id, {
          create_time: Number(payme.create_time || Date.now()),
          transaction: existing.id,
          state: existing.status === 'paid' ? 2 : existing.status === 'cancelled' ? Number(payme.state || -1) : 1
        })
      }

      const { data: active, error: activeError } = await admin.from('monetization_payment_attempts').select('id,status,provider_payment_id,provider_payload').eq('provider', 'payme').eq('order_id', orderId).in('status', ['pending', 'processing', 'paid']).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (activeError) throw activeError
      if (active && active.provider_payment_id && active.provider_payment_id !== transactionId) return rpcError(body.id, -31099, 'Other transaction for this order is in progress', 'order_id')

      const createTime = Date.now()

      const { error: reserveError } = await admin.from('monetization_orders')
        .update({ status: 'awaiting_payment', provider: 'payme', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .in('status', ['pending', 'awaiting_payment'])
        .in('provider', ['unconfigured', 'payme'])
      if (reserveError) throw reserveError

      const { data: attempt, error: insertError } = await admin.from('monetization_payment_attempts').insert({
        order_id: order.id,
        user_id: order.user_id,
        provider: 'payme',
        provider_payment_id: transactionId,
        status: 'processing',
        amount_uzs: order.subtotal_uzs,
        currency: order.currency,
        idempotency_key: `payme:${transactionId}`,
        provider_payload: { payme: { id: transactionId, time, amount, account, create_time: createTime, state: 1 } },
      }).select('id').single()
      if (insertError) throw insertError

      return rpcResult(body.id, { create_time: createTime, transaction: attempt.id, state: 1 })
    }

    if (method === 'PerformTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      if (!transactionId) return rpcError(body.id, -31003, 'Transaction not found')
      const { data: attempt, error } = await admin.from('monetization_payment_attempts').select('id,order_id,status,provider_payment_id,provider_payload').eq('provider', 'payme').eq('provider_payment_id', transactionId).maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      if (attempt.status === 'paid') {
        const payload = (attempt.provider_payload || {}) as Record<string, unknown>
        const payme = (payload.payme || {}) as Record<string, unknown>
        const performTime = Number(payme.perform_time || Date.now())

        // A previous PerformTransaction may have persisted the payment before
        // activation completed. Retry the idempotent activation on subsequent
        // Payme retries instead of acknowledging an unfulfilled paid order.
        const { error: orderError } = await admin.from('monetization_orders')
          .update({ status: 'paid', provider: 'payme', provider_order_id: transactionId, updated_at: new Date().toISOString() })
          .eq('id', attempt.order_id)
          .in('status', ['pending', 'awaiting_payment', 'paid'])
        if (orderError) throw orderError

        const { error: activationError } = await admin.rpc('activate_monetization_order', { p_order_id: attempt.order_id })
        if (activationError) throw activationError

        return rpcResult(body.id, { transaction: attempt.id, perform_time: performTime, state: 2 })
      }
      if (attempt.status !== 'processing') return rpcError(body.id, -31008, 'Operation is not allowed')

      const performTime = Date.now()
      const payload = (attempt.provider_payload || {}) as Record<string, unknown>
      const payme = (payload.payme || {}) as Record<string, unknown>
      const nextPayload = { ...payload, payme: { ...payme, perform_time: performTime, state: 2 } }
      const { error: updateError } = await admin.from('monetization_payment_attempts')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          provider_payload: nextPayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
        .eq('status', 'processing')
      if (updateError) throw updateError

      const { error: orderError } = await admin.from('monetization_orders')
        .update({
          status: 'paid',
          provider: 'payme',
          provider_order_id: transactionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.order_id)
        .in('status', ['pending', 'awaiting_payment', 'paid'])
      if (orderError) throw orderError

      const { error: activationError } = await admin.rpc('activate_monetization_order', { p_order_id: attempt.order_id })
      if (activationError) throw activationError

      return rpcResult(body.id, { transaction: attempt.id, perform_time: performTime, state: 2 })
    }

    if (method === 'CancelTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const reason = Number.isFinite(Number(params.reason)) ? Number(params.reason) : -1
      const { data: attempt, error } = await admin.from('monetization_payment_attempts').select('id,order_id,status,provider_payload').eq('provider', 'payme').eq('provider_payment_id', transactionId).maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      const payload = (attempt.provider_payload || {}) as Record<string, unknown>
      const payme = (payload.payme || {}) as Record<string, unknown>

      // Royalhouse activates the purchased entitlement during PerformTransaction.
      // A post-payment cancellation therefore requires a controlled refund flow;
      // it must not silently cancel the payment while leaving the entitlement active.
      if (attempt.status === 'paid' || Number(payme.perform_time || 0) > 0) {
        return rpcError(body.id, -31007, 'Order has already been completed')
      }

      // Payme may retry CancelTransaction. For an already-cancelled transaction,
      // the response must be identical to the first successful cancellation.
      if (attempt.status === 'cancelled') {
        const cancelTime = Number(payme.cancel_time || 0)
        const state = Number(payme.state || -1)
        return rpcResult(body.id, {
          transaction: attempt.id,
          cancel_time: cancelTime,
          state,
        })
      }

      const cancelTime = Date.now()
      const state = -1
      const nextPayload = { ...payload, payme: { ...payme, cancel_reason: reason, cancel_time: cancelTime, state } }
      const { error: updateError } = await admin.from('monetization_payment_attempts')
        .update({
          status: 'cancelled',
          provider_payload: nextPayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
        .in('status', ['pending', 'processing'])
      if (updateError) throw updateError

      return rpcResult(body.id, { transaction: attempt.id, cancel_time: cancelTime, state })
    }

    if (method === 'GetStatement') {
      const from = Number(params.from)
      const to = Number(params.to)
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
        return rpcError(body.id, -32602, 'Invalid params')
      }

      const { data: attempts, error } = await admin
        .from('monetization_payment_attempts')
        .select('id,provider_payment_id,status,amount_uzs,provider_payload,created_at')
        .eq('provider', 'payme')
        .order('created_at', { ascending: true })

      if (error) throw error

      const transactions = (attempts || [])
        .map((attempt: any) => {
          const payload = (attempt.provider_payload || {}) as Record<string, unknown>
          const payme = (payload.payme || {}) as Record<string, unknown>
          const time = Number(payme.time || payme.create_time || new Date(attempt.created_at).getTime())
          const state = attempt.status === 'paid'
            ? 2
            : attempt.status === 'cancelled'
              ? Number(payme.state || (Number(payme.perform_time || 0) > 0 ? -2 : -1))
              : 1

          return {
            id: attempt.provider_payment_id,
            time,
            amount: Number(payme.amount || Math.round(Number(attempt.amount_uzs) * 100)),
            account: payme.account || {},
            create_time: Number(payme.create_time || new Date(attempt.created_at).getTime()),
            perform_time: Number(payme.perform_time || 0),
            cancel_time: Number(payme.cancel_time || 0),
            transaction: attempt.id,
            state,
            reason: payme.cancel_reason ?? null,
          }
        })
        .filter((transaction: any) => transaction.id && transaction.time >= from && transaction.time <= to)

      return rpcResult(body.id, { transactions })
    }

    if (method === 'CheckTransaction') {
      const transactionId = typeof params.id === 'string' ? params.id : ''
      const { data: attempt, error } = await admin.from('monetization_payment_attempts').select('id,status,provider_payload,created_at').eq('provider', 'payme').eq('provider_payment_id', transactionId).maybeSingle()
      if (error) throw error
      if (!attempt) return rpcError(body.id, -31003, 'Transaction not found')
      const payload = (attempt.provider_payload || {}) as Record<string, unknown>
      const payme = (payload.payme || {}) as Record<string, unknown>
      const state = attempt.status === 'paid' ? 2 : attempt.status === 'cancelled' ? Number(payme.state || -1) : 1
      return rpcResult(body.id, { create_time: Number(payme.create_time || new Date(attempt.created_at).getTime()), perform_time: Number(payme.perform_time || 0), cancel_time: Number(payme.cancel_time || 0), transaction: attempt.id, state, reason: payme.cancel_reason ?? null })
    }

    return rpcError(body.id, -32601, 'Method not found', method)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payme merchant error'
    return rpcError(body.id, errorCode(message), undefined)
  }
}

export async function GET() {
  return rpcError(null, -32300, 'Request method must be POST')
}
