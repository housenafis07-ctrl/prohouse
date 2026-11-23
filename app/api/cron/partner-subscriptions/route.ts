import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
import { deliverPendingTelegramNotifications, queueTelegramNotification } from '@/utils/telegram/notifications'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()

  const { data: result, error: syncError } = await db.rpc('sync_partner_subscription_visibility')
  if (syncError) {
    console.error('[partner subscription cron] visibility sync failed', syncError)
    return NextResponse.json({ error: 'Visibility sync failed' }, { status: 500 })
  }

  const now = new Date()
  const warningStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const warningEnd = new Date(warningStart.getTime() + 60 * 60 * 1000)

  const { data: expiring, error: expiringError } = await db
    .from('monetization_entitlements')
    .select('id,user_id,product_code,ends_at')
    .eq('status', 'active')
    .not('ends_at', 'is', null)
    .gte('ends_at', warningStart.toISOString())
    .lt('ends_at', warningEnd.toISOString())

  if (expiringError) {
    console.error('[partner subscription cron] expiring lookup failed', expiringError)
    return NextResponse.json({ error: 'Expiring lookup failed' }, { status: 500 })
  }

  let queued = 0
  for (const entitlement of expiring ?? []) {
    const { data: product } = await db
      .from('monetization_products')
      .select('name,metadata')
      .eq('code', entitlement.product_code)
      .eq('product_type', 'subscription')
      .eq('audience', 'partner')
      .maybeSingle()

    if (!product) continue

    const { data: partner } = await db
      .from('partner_profiles')
      .select('user_id,company_name')
      .eq('user_id', entitlement.user_id)
      .maybeSingle()

    if (!partner) continue

    const { data: existingWarning } = await db
      .from('telegram_notification_queue')
      .select('id')
      .eq('profile_id', entitlement.user_id)
      .eq('event_type', 'partner_subscription_expiry_warning')
      .gte('created_at', new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle()

    if (existingWarning) continue

    const endsAt = new Date(entitlement.ends_at as string)
    const days = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    const message = [
      `RoyalHouse: ${product.name} tarifingiz ${days} kundan keyin tugaydi.`,
      'Tarifni uzaytirmasangiz, tarif limitingizdan tashqari e’lonlaringiz saytda vaqtincha yashiriladi, lekin shaxsiy kabinetingizda saqlanadi.',
      'Tarifni uzaytirish uchun shaxsiy kabinetingizdagi “Hisob va to‘lovlar” bo‘limiga kiring.',
    ].join('\n\n')

    await queueTelegramNotification(db, entitlement.user_id, 'partner_subscription_expiry_warning', message)
    queued++
  }

  const delivery = await deliverPendingTelegramNotifications(db)

  return NextResponse.json({
    ok: true,
    visibility: result ?? null,
    warningsQueued: queued,
    notifications: delivery,
  })
}
