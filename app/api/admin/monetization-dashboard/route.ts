import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Payment = {
  id: string
  order_id: string
  provider: string
  status: string
  amount_uzs: number | string
  paid_at: string | null
  created_at: string
}

type Rental = {
  id: string
  listing_id: string | null
  guest_id: string | null
  deposit_amount: number | string | null
  payment_provider: string | null
  payment_status: string | null
  status: string | null
  provider_payment_id: string | null
  paid_at: string | null
  created_at: string
}

function dayKey(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return null
  const uz = new Date(d.getTime() + 5 * 60 * 60 * 1000)
  return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}-${String(uz.getUTCDate()).padStart(2, '0')}`
}

function money(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    const [{ data: paymentRows, error: paymentError }, { data: rentalRows, error: rentalError }] = await Promise.all([
      db.from('monetization_payment_attempts')
        .select('id,order_id,provider,status,amount_uzs,paid_at,created_at')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .range(0, 9999),
      db.from('rental_bookings')
        .select('id,listing_id,guest_id,deposit_amount,payment_provider,payment_status,status,provider_payment_id,paid_at,created_at')
        .eq('payment_status', 'paid')
        .eq('status', 'confirmed')
        .not('provider_payment_id', 'is', null)
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false })
        .range(0, 9999),
    ])
    if (paymentError) throw paymentError
    if (rentalError) throw rentalError

    const payments = (paymentRows || []) as Payment[]
    const rentals = (rentalRows || []) as Rental[]
    const orderIds = [...new Set(payments.map(row => row.order_id).filter(Boolean))]
    const orders: any[] = []
    const items: any[] = []

    for (let offset = 0; offset < orderIds.length; offset += 200) {
      const batch = orderIds.slice(offset, offset + 200)
      const [orderResult, itemResult] = await Promise.all([
        db.from('monetization_orders').select('id,user_id').in('id', batch),
        db.from('monetization_order_items').select('order_id,product_code,quantity,unit_price_uzs').in('order_id', batch),
      ])
      if (orderResult.error) throw orderResult.error
      if (itemResult.error) throw itemResult.error
      orders.push(...(orderResult.data || []))
      items.push(...(itemResult.data || []))
    }

    const productCodes = [...new Set(items.map(item => item.product_code).filter(Boolean))]
    const products: any[] = []
    for (let offset = 0; offset < productCodes.length; offset += 200) {
      const batch = productCodes.slice(offset, offset + 200)
      const { data, error: productError } = await db.from('monetization_products').select('code,name,name_ru,product_type').in('code', batch)
      if (productError) throw productError
      products.push(...(data || []))
    }

    const orderMap = new Map(orders.map(order => [order.id, order]))
    const productMap = new Map(products.map(product => [product.code, product]))
    const itemsByOrder = new Map<string, any[]>()
    for (const item of items) {
      const bucket = itemsByOrder.get(item.order_id) || []
      bucket.push(item)
      itemsByOrder.set(item.order_id, bucket)
    }

    const userIds = [...new Set(orders.map(order => order.user_id).filter((id): id is string => typeof id === 'string'))]
    const rentalUserIds = rentals.map(row => row.guest_id).filter((id): id is string => typeof id === 'string')
    const profileIds = [...new Set([...userIds, ...rentalUserIds])]
    const profiles: any[] = []
    for (let offset = 0; offset < profileIds.length; offset += 200) {
      const batch = profileIds.slice(offset, offset + 200)
      const { data, error: profileError } = await db.from('profiles').select('id,full_name,company_name,phone').in('id', batch)
      if (profileError) throw profileError
      profiles.push(...(data || []))
    }
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]))

    const serviceMap = new Map<string, { code: string; name_uz: string; name_ru: string; revenue: number; payments: number; customers: Set<string> }>()
    const customerMap = new Map<string, { id: string; name: string; phone: string | null; revenue: number; payments: number; services: Set<string> }>()
    const providerMap = new Map<string, { provider: string; revenue: number; payments: number; customers: Set<string> }>()
    const dailyMap = new Map<string, { revenue: number; payments: number; customers: Set<string> }>()

    const addRevenue = (date: string | null, revenue: number, customerId: string | null, provider: string, serviceCode: string, serviceNameUz: string, serviceNameRu: string) => {
      const service = serviceMap.get(serviceCode) || { code: serviceCode, name_uz: serviceNameUz, name_ru: serviceNameRu, revenue: 0, payments: 0, customers: new Set<string>() }
      service.revenue += revenue
      service.payments += 1
      if (customerId) service.customers.add(customerId)
      serviceMap.set(serviceCode, service)

      const providerRow = providerMap.get(provider) || { provider, revenue: 0, payments: 0, customers: new Set<string>() }
      providerRow.revenue += revenue
      providerRow.payments += 1
      if (customerId) providerRow.customers.add(customerId)
      providerMap.set(provider, providerRow)

      const key = dayKey(date)
      if (key) {
        const day = dailyMap.get(key) || { revenue: 0, payments: 0, customers: new Set<string>() }
        day.revenue += revenue
        day.payments += 1
        if (customerId) day.customers.add(customerId)
        dailyMap.set(key, day)
      }

      if (customerId) {
        const profile: any = profileMap.get(customerId)
        const customer = customerMap.get(customerId) || {
          id: customerId,
          name: profile?.full_name || profile?.company_name || 'Noma’lum mijoz',
          phone: profile?.phone || null,
          revenue: 0,
          payments: 0,
          services: new Set<string>(),
        }
        customer.revenue += revenue
        customer.payments += 1
        customer.services.add(serviceCode)
        customerMap.set(customerId, customer)
      }
    }

    for (const row of payments) {
      const customerId = orderMap.get(row.order_id)?.user_id || null
      const orderItems = itemsByOrder.get(row.order_id) || []
      const totals = orderItems.map(item => Math.max(0, money(item.unit_price_uzs) * Math.max(1, money(item.quantity))))
      const total = totals.reduce((sum, value) => sum + value, 0)
      if (!orderItems.length) {
        addRevenue(row.paid_at, money(row.amount_uzs), customerId, row.provider || 'unknown', 'unknown', 'Monetizatsiya', 'Монетизация')
        continue
      }
      for (let index = 0; index < orderItems.length; index++) {
        const item = orderItems[index]
        const product: any = productMap.get(item.product_code)
        const share = total > 0 ? totals[index] / total : 1 / orderItems.length
        addRevenue(row.paid_at, money(row.amount_uzs) * share, customerId, row.provider || 'unknown', item.product_code || 'unknown', product?.name || item.product_code || 'Xizmat', product?.name_ru || product?.name || item.product_code || 'Услуга')
      }
    }

    for (const row of rentals) {
      const customerId = row.guest_id || null
      addRevenue(row.paid_at, money(row.deposit_amount), customerId, row.payment_provider || 'payme', 'rental_deposit', 'Dacha avans to‘lovlari', 'Авансовые платежи за дачу')
    }

    const totalRevenue = [...serviceMap.values()].reduce((sum, row) => sum + row.revenue, 0)
    const customerRows = [...customerMap.values()].sort((a, b) => b.revenue - a.revenue)
    const serviceRows = [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue)
    const providerRows = [...providerMap.values()].sort((a, b) => b.revenue - a.revenue)
    const days: { key: string; label: string; revenue: number; payments: number; customers: number }[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - i)
      const uz = new Date(d.getTime() + 5 * 60 * 60 * 1000)
      const key = `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}-${String(uz.getUTCDate()).padStart(2, '0')}`
      const row = dailyMap.get(key)
      days.push({ key, label: `${String(uz.getUTCDate()).padStart(2, '0')}.${String(uz.getUTCMonth() + 1).padStart(2, '0')}`, revenue: row?.revenue || 0, payments: row?.payments || 0, customers: row?.customers.size || 0 })
    }

    const uniqueCustomers = customerRows.length
    const repeatCustomers = customerRows.filter(row => row.payments >= 2).length
    const todayKey = dayKey(new Date().toISOString())
    const monthPrefix = todayKey ? todayKey.slice(0, 7) : ''
    const monthRevenue = days.filter(row => row.key.startsWith(monthPrefix)).reduce((sum, row) => sum + row.revenue, 0)
    const monthPayments = days.filter(row => row.key.startsWith(monthPrefix)).reduce((sum, row) => sum + row.payments, 0)
    const previousMonthCustomerIds = new Set<string>()
    const currentMonthCustomerIds = new Set<string>()
    for (const row of payments) {
      const key = dayKey(row.paid_at)
      if (!key) continue
      const id = orderMap.get(row.order_id)?.user_id
      if (!id) continue
      if (key.startsWith(monthPrefix)) currentMonthCustomerIds.add(id)
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: { paymentAttempts: payments.length, rentalBookings: rentals.length, capped: payments.length >= 10000 || rentals.length >= 10000 },
      totals: {
        revenue: totalRevenue,
        payments: payments.length + rentals.length,
        customers: uniqueCustomers,
        arppu: uniqueCustomers ? totalRevenue / uniqueCustomers : 0,
        averageCheck: payments.length + rentals.length ? totalRevenue / (payments.length + rentals.length) : 0,
        repeatRate: uniqueCustomers ? repeatCustomers / uniqueCustomers * 100 : 0,
        monthRevenue,
        monthPayments,
        currentMonthCustomers: currentMonthCustomerIds.size,
        previousMonthCustomers: previousMonthCustomerIds.size,
      },
      trend: days,
      services: serviceRows.slice(0, 12).map(row => ({ ...row, customers: row.customers.size, share: totalRevenue ? row.revenue / totalRevenue * 100 : 0 })),
      providers: providerRows.map(row => ({ ...row, customers: row.customers.size, share: totalRevenue ? row.revenue / totalRevenue * 100 : 0 })),
      customers: customerRows.slice(0, 12).map(row => ({ ...row, services: row.services.size })),
    })
  } catch (error) {
    console.error('[monetization-dashboard]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dashboard data error' }, { status: 500 })
  }
}
