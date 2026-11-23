import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Attempt = {
  id: string
  order_id: string
  user_id: string | null
  provider: string
  status: string
  amount_uzs: number | string
  currency: string | null
  provider_payment_id: string | null
  paid_at: string | null
  created_at: string
}

function startOfUzbekDay(date: Date) {
  const uz = new Date(date.getTime() + 5 * 60 * 60 * 1000)
  return Date.UTC(uz.getUTCFullYear(), uz.getUTCMonth(), uz.getUTCDate()) - 5 * 60 * 60 * 1000
}

function inPeriod(value: string | null, start: number, end: number) {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time >= start && time < end
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const now = new Date()
    const todayStart = startOfUzbekDay(now)
    const uzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    const monthStart = Date.UTC(uzNow.getUTCFullYear(), uzNow.getUTCMonth(), 1) - 5 * 60 * 60 * 1000
    const yearStart = Date.UTC(uzNow.getUTCFullYear(), 0, 1) - 5 * 60 * 60 * 1000
    const nowMs = now.getTime()

    const [{ data: paidRows, error: paidError }, { data: recentRows, error: recentError }, { data: paidRentalRows, error: paidRentalError }, { data: recentRentalRows, error: recentRentalError }] = await Promise.all([
      db.from('monetization_payment_attempts')
        .select('id,order_id,provider,status,amount_uzs,currency,provider_payment_id,paid_at,created_at')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .range(0, 9999),
      db.from('monetization_payment_attempts')
        .select('id,order_id,provider,status,amount_uzs,currency,provider_payment_id,paid_at,created_at')
        .order('created_at', { ascending: false })
        .range(0, 999),
      db.from('rental_bookings')
        .select('id,listing_id,guest_id,deposit_amount,currency,payment_provider,payment_status,status,provider_payment_id,paid_at,created_at,check_in,check_out')
        .eq('payment_provider', 'payme').eq('payment_status', 'paid').eq('status', 'confirmed').not('provider_payment_id', 'is', null).not('paid_at', 'is', null)
        .order('paid_at', { ascending: false }).range(0, 9999),
      db.from('rental_bookings')
        .select('id,listing_id,guest_id,deposit_amount,currency,payment_provider,payment_status,status,provider_payment_id,paid_at,created_at,check_in,check_out')
        .eq('payment_provider', 'payme').order('created_at', { ascending: false }).range(0, 999),
    ])
    if (paidError) throw paidError
    if (recentError) throw recentError
    if (paidRentalError) throw paidRentalError
    if (recentRentalError) throw recentRentalError

    const paid = (paidRows || []) as Attempt[]
    const recent = (recentRows || []) as Attempt[]
    const paidRentals: any[] = paidRentalRows || []
    const recentRentals: any[] = recentRentalRows || []
    const rentalGuestIds = [...new Set([...paidRentals, ...recentRentals].map(row => row.guest_id).filter(Boolean))]
    const rentalListingIds = [...new Set([...paidRentals, ...recentRentals].map(row => row.listing_id).filter(Boolean))]
    const rentalProfiles: any[] = []
    const rentalListings: any[] = []
    for (let offset = 0; offset < rentalGuestIds.length; offset += 200) {
      const batch = rentalGuestIds.slice(offset, offset + 200)
      const { data, error: rentalProfileError } = await db.from('profiles').select('id,full_name,phone,company_name').in('id', batch)
      if (rentalProfileError) throw rentalProfileError
      rentalProfiles.push(...(data || []))
    }
    for (let offset = 0; offset < rentalListingIds.length; offset += 200) {
      const batch = rentalListingIds.slice(offset, offset + 200)
      const { data, error: rentalListingError } = await db.from('listings').select('*').in('id', batch)
      if (rentalListingError) throw rentalListingError
      rentalListings.push(...(data || []))
    }
    const rentalProfileMap = new Map(rentalProfiles.map(profile => [profile.id, profile]))
    const rentalListingMap = new Map(rentalListings.map(listing => [listing.id, listing]))
    const rentalAmount = (rows: any[]) => rows.reduce((sum, row) => sum + Number(row.deposit_amount || 0), 0)
    const orderIds = [...new Set([...paid, ...recent].map(row => row.order_id).filter(Boolean))]
    const userIds: string[] = []

    const orders: any[] = []
    const items: any[] = []
    const profiles: any[] = []
    // Keep each IN query small enough for Supabase/PostgREST URL limits.
    for (let offset = 0; offset < orderIds.length; offset += 200) {
      const batch = orderIds.slice(offset, offset + 200)
      const [orderResult, itemResult] = await Promise.all([
        db.from('monetization_orders').select('*').in('id', batch),
        db.from('monetization_order_items').select('order_id,product_code,listing_id,quantity,unit_price_uzs').in('order_id', batch),
      ])
      if (orderResult.error) throw orderResult.error
      if (itemResult.error) throw itemResult.error
      orders.push(...(orderResult.data || []))
      items.push(...(itemResult.data || []))
    }
    const productCodes = [...new Set(items.map((item: any) => item.product_code).filter(Boolean))]
    const products: any[] = []
    for (let offset = 0; offset < productCodes.length; offset += 200) {
      const batch = productCodes.slice(offset, offset + 200)
      const { data, error: productsError } = await db.from('monetization_products').select('code,name,name_ru,product_type').in('code', batch)
      if (productsError) throw productsError
      products.push(...(data || []))
    }

    userIds.push(...new Set((orders || []).map((order: any) => order.user_id).filter((id: unknown): id is string => typeof id === 'string')))
    // Fetch profiles for users resolved through the order record; payment attempts do not store user_id.
    const uniqueUserIds = [...new Set(userIds)]
    profiles.splice(0, profiles.length)
    for (let offset = 0; offset < uniqueUserIds.length; offset += 200) {
      const batch = uniqueUserIds.slice(offset, offset + 200)
      const { data, error: profileError } = await db.from('profiles').select('id,full_name,phone,company_name').in('id', batch)
      if (profileError) throw profileError
      profiles.push(...(data || []))
    }

    const orderMap = new Map((orders || []).map((order: any) => [order.id, order]))
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
    const productMap = new Map((products || []).map((product: any) => [product.code, product]))
    const itemsByOrder = new Map<string, any[]>()
    for (const item of items || []) {
      const bucket = itemsByOrder.get(item.order_id) || []
      bucket.push(item)
      itemsByOrder.set(item.order_id, bucket)
    }

    const paidAmount = (rows: Attempt[]) => rows.reduce((sum, row) => sum + Number(row.amount_uzs || 0), 0)
    const paidThisMonth = paid.filter(row => inPeriod(row.paid_at, monthStart, nowMs + 1))
    const paidThisYear = paid.filter(row => inPeriod(row.paid_at, yearStart, nowMs + 1))
    const paidToday = paid.filter(row => inPeriod(row.paid_at, todayStart, nowMs + 1))
    const paidRentalsThisMonth = paidRentals.filter(row => inPeriod(row.paid_at, monthStart, nowMs + 1))
    const paidRentalsThisYear = paidRentals.filter(row => inPeriod(row.paid_at, yearStart, nowMs + 1))
    const paidRentalsToday = paidRentals.filter(row => inPeriod(row.paid_at, todayStart, nowMs + 1))
    const customerCount = new Set(paid.map(row => orderMap.get(row.order_id)?.user_id).filter(Boolean)).size
    const monthlyCustomerCount = new Set(paidThisMonth.map(row => orderMap.get(row.order_id)?.user_id).filter(Boolean)).size
    const yearlyCustomerCount = new Set(paidThisYear.map(row => orderMap.get(row.order_id)?.user_id).filter(Boolean)).size

    const transactions = recent.map(row => {
      const order: any = orderMap.get(row.order_id)
      const profile: any = profileMap.get(order?.user_id)
      const orderItems = itemsByOrder.get(row.order_id) || []
      const serviceNames = orderItems.map(item => {
        const product: any = productMap.get(item.product_code)
        return {
          code: item.product_code,
          name_uz: product?.name || item.product_code || 'Xizmat',
          name_ru: product?.name_ru || product?.name || item.product_code || 'Услуга',
          product_type: product?.product_type || '',
          quantity: Number(item.quantity || 1),
          listing_id: item.listing_id || order?.listing_id || null,
        }
      })
      return {
        id: row.id,
        order_id: row.order_id,
        customer_id: order?.user_id || null,
        customer_name: profile?.full_name || profile?.company_name || 'Noma’lum mijoz',
        customer_phone: profile?.phone || null,
        provider: row.provider,
        status: row.status,
        amount_uzs: Number(row.amount_uzs || 0),
        currency: row.currency || 'UZS',
        provider_payment_id: row.provider_payment_id,
        paid_at: row.paid_at,
        created_at: row.created_at,
        services: serviceNames,
      }
    })

    const rentalTransactions = recentRentals.map(row => {
      const profile: any = rentalProfileMap.get(row.guest_id)
      const listing: any = rentalListingMap.get(row.listing_id)
      const listingName = listing?.title || listing?.name || listing?.draft_data?.title || listing?.draft_data?.name || 'Dacha bron avansi'
      const status = row.payment_status === 'paid' && row.status === 'confirmed' && row.provider_payment_id && row.paid_at ? 'paid' : row.payment_status === 'cancelled' ? 'cancelled' : row.payment_status === 'failed' ? 'failed' : row.payment_status === 'processing' ? 'processing' : 'pending'
      return {
        id: 'rental:' + row.id, order_id: row.id, customer_id: row.guest_id || null,
        customer_name: profile?.full_name || profile?.company_name || 'Noma’lum mijoz', customer_phone: profile?.phone || null,
        provider: row.payment_provider || 'payme', status, amount_uzs: Number(row.deposit_amount || 0), currency: row.currency || 'UZS',
        provider_payment_id: row.provider_payment_id || null, paid_at: row.paid_at || null, created_at: row.created_at,
        services: [{ code: 'rental_deposit', name_uz: 'Dacha avans to‘lovi — ' + listingName, name_ru: 'Аванс за дачу — ' + listingName, product_type: 'rental_deposit', quantity: 1, listing_id: row.listing_id || null }],
      }
    })
    const allTransactions = [...transactions, ...rentalTransactions].sort((a, b) => new Date(b.created_at || b.paid_at || 0).getTime() - new Date(a.created_at || a.paid_at || 0).getTime()).slice(0, 1000)

    const byService = new Map<string, {
      code: string; name_uz: string; name_ru: string; product_type: string;
      payments: number; customers: Set<string>; all_time: number; today: number; month: number; year: number;
      order_ids: Set<string>
    }>()
    const seenServicePayments = new Set<string>()
    for (const row of paid) {
      const orderItems = itemsByOrder.get(row.order_id) || []
      if (!orderItems.length) continue
      const itemTotals = orderItems.map((item: any) => Math.max(0, Number(item.unit_price_uzs || 0) * Number(item.quantity || 1)))
      const itemsTotal = itemTotals.reduce((sum: number, amount: number) => sum + amount, 0)
      // Allocate the actual received amount across the order's products proportionally.
      // If line prices are unavailable/zero, use an equal split rather than inventing revenue.
      const allocatedAmounts = orderItems.map((item: any, index: number) =>
        itemsTotal > 0 ? Number(row.amount_uzs || 0) * itemTotals[index] / itemsTotal : Number(row.amount_uzs || 0) / orderItems.length
      )
      for (let index = 0; index < orderItems.length; index++) {
        const item = orderItems[index]
        const product: any = productMap.get(item.product_code)
        const code = item.product_code || 'unknown'
        const entry = byService.get(code) || {
          code,
          name_uz: product?.name || code,
          name_ru: product?.name_ru || product?.name || code,
          product_type: product?.product_type || 'other',
          payments: 0,
          customers: new Set<string>(),
          all_time: 0,
          today: 0,
          month: 0,
          year: 0,
          order_ids: new Set<string>(),
        }
        const allocated = allocatedAmounts[index]
        entry.all_time += allocated
        if (inPeriod(row.paid_at, todayStart, nowMs + 1)) entry.today += allocated
        if (inPeriod(row.paid_at, monthStart, nowMs + 1)) entry.month += allocated
        if (inPeriod(row.paid_at, yearStart, nowMs + 1)) entry.year += allocated
        const paymentKey = row.id + ':' + code
        if (!seenServicePayments.has(paymentKey)) {
          entry.payments += 1
          seenServicePayments.add(paymentKey)
        }
        const customerId = orderMap.get(row.order_id)?.user_id
        if (customerId) entry.customers.add(customerId)
        entry.order_ids.add(row.order_id)
        byService.set(code, entry)
      }
    }
    if (paidRentals.length) {
      const all = rentalAmount(paidRentals)
      const today = rentalAmount(paidRentalsToday)
      const month = rentalAmount(paidRentalsThisMonth)
      const year = rentalAmount(paidRentalsThisYear)
      byService.set('rental_deposit', {
        code: 'rental_deposit', name_uz: 'Dacha avans to‘lovlari', name_ru: 'Авансовые платежи за дачу', product_type: 'rental_deposit',
        payments: paidRentals.length, customers: new Set(paidRentals.map(row => row.guest_id).filter(Boolean)), all_time: all, today, month, year, order_ids: new Set(paidRentals.map(row => row.id)),
      })
    }
    const serviceReport = [...byService.values()]
      .map(({ customers, order_ids, ...item }) => ({
        ...item,
        customers: customers.size,
        orders: order_ids.size,
        share_percent: (paidAmount(paid) + rentalAmount(paidRentals)) > 0 ? Math.round(item.all_time / (paidAmount(paid) + rentalAmount(paidRentals)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.all_time - a.all_time)

    return NextResponse.json({
      summary: {
        all_time: { amount_uzs: paidAmount(paid) + rentalAmount(paidRentals), payments: paid.length + paidRentals.length, customers: new Set([...paid.map(row => orderMap.get(row.order_id)?.user_id), ...paidRentals.map(row => row.guest_id)].filter(Boolean)).size },
        today: { amount_uzs: paidAmount(paidToday) + rentalAmount(paidRentalsToday), payments: paidToday.length + paidRentalsToday.length, customers: new Set([...paidToday.map(row => orderMap.get(row.order_id)?.user_id), ...paidRentalsToday.map(row => row.guest_id)].filter(Boolean)).size },
        month: { amount_uzs: paidAmount(paidThisMonth) + rentalAmount(paidRentalsThisMonth), payments: paidThisMonth.length + paidRentalsThisMonth.length, customers: new Set([...paidThisMonth.map(row => orderMap.get(row.order_id)?.user_id), ...paidRentalsThisMonth.map(row => row.guest_id)].filter(Boolean)).size },
        year: { amount_uzs: paidAmount(paidThisYear) + rentalAmount(paidRentalsThisYear), payments: paidThisYear.length + paidRentalsThisYear.length, customers: new Set([...paidThisYear.map(row => orderMap.get(row.order_id)?.user_id), ...paidRentalsThisYear.map(row => row.guest_id)].filter(Boolean)).size },
      },
      by_service: serviceReport,
      transactions: allTransactions,
      truncated: paid.length === 10000 || paidRentals.length === 10000,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (e) {
    const detail = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : e instanceof Error ? e.message : ''
    console.error('[admin/payment-report] failed:', detail || e)
    return NextResponse.json({ error: detail || 'PAYMENT_REPORT_FAILED' }, { status: 500 })
  }
}
