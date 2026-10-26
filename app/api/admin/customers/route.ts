import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type CustomerRow = {
  id: string
  name: string
  telegram_name: string | null
  telegram_username: string | null
  telegram_id: string | null
  phone: string | null
  account_type: string | null
  listing_count: number
  paid_total_uzs: number
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

async function loadCustomers(request: NextRequest): Promise<CustomerRow[]> {
  const db = serviceClient()
  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || ''
  const accountType = request.nextUrl.searchParams.get('accountType')?.trim() || ''
  const payment = request.nextUrl.searchParams.get('payment')?.trim() || ''

  let profileQuery = db
    .from('profiles')
    .select('id,profile_code,full_name,phone,account_type,company_name')
    .order('created_at', { ascending: false })
    .range(0, 9999)

  if (accountType) profileQuery = profileQuery.eq('account_type', accountType)

  const { data: profileData, error: profileError } = await profileQuery
  if (profileError) throw profileError

  let profiles = profileData || []
  if (q) {
    profiles = profiles.filter((profile: any) => {
      const values = [
        profile.full_name,
        profile.company_name,
        profile.phone,
        profile.profile_code,
        profile.account_type,
      ]
      return values.some(value => String(value || '').toLowerCase().includes(q))
    })
  }

  const profileIds = profiles.map((profile: any) => profile.id).filter(Boolean)
  if (!profileIds.length) return []

  const listingCounts = new Map<string, number>()
  const telegramByProfile = new Map<string, { username: string | null; first_name: string | null; last_name: string | null; telegram_id: string | null }>()
  const paymentTotals = new Map<string, number>()

  for (let offset = 0; offset < profileIds.length; offset += 200) {
    const batch = profileIds.slice(offset, offset + 200)

    const [{ data: listingRows, error: listingError }, { data: botRows, error: botError }, { data: linkRows, error: linkError }] = await Promise.all([
      db.from('listings').select('owner_id').in('owner_id', batch),
      db.from('telegram_bot_users').select('profile_id,telegram_user_id,username,first_name,last_name').in('profile_id', batch),
      db.from('telegram_user_links').select('profile_id,telegram_user_id,telegram_username').in('profile_id', batch),
    ])

    if (listingError) throw listingError
    if (botError && !String(botError.message || '').toLowerCase().includes('does not exist')) throw botError
    if (linkError && !String(linkError.message || '').toLowerCase().includes('does not exist')) throw linkError

    for (const row of listingRows || []) {
      if (row.owner_id) listingCounts.set(row.owner_id, (listingCounts.get(row.owner_id) || 0) + 1)
    }

    for (const row of botRows || []) {
      if (!row.profile_id) continue
      telegramByProfile.set(row.profile_id, {
        username: row.username || null,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        telegram_id: row.telegram_user_id ? String(row.telegram_user_id) : null,
      })
    }

    for (const row of linkRows || []) {
      if (!row.profile_id) continue
      const current = telegramByProfile.get(row.profile_id)
      telegramByProfile.set(row.profile_id, {
        username: current?.username || row.telegram_username || null,
        first_name: current?.first_name || null,
        last_name: current?.last_name || null,
        telegram_id: current?.telegram_id || (row.telegram_user_id ? String(row.telegram_user_id) : null),
      })
    }
  }

  const paidAttempts: any[] = []
  const monetizationOrders: any[] = []
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await db
      .from('monetization_payment_attempts')
      .select('order_id,amount_uzs,status,paid_at')
      .eq('status', 'paid')
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .range(offset, offset + 999)
    if (error) throw error
    paidAttempts.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const orderIds = [...new Set(paidAttempts.map(row => row.order_id).filter(Boolean))]
  for (let offset = 0; offset < orderIds.length; offset += 200) {
    const batch = orderIds.slice(offset, offset + 200)
    const { data, error } = await db.from('monetization_orders').select('id,user_id').in('id', batch)
    if (error) throw error
    monetizationOrders.push(...(data || []))
  }

  const orderUser = new Map<string, string>()
  for (const order of monetizationOrders) {
    if (order.id && order.user_id) orderUser.set(order.id, order.user_id)
  }

  for (const attempt of paidAttempts) {
    const userId = orderUser.get(attempt.order_id)
    if (!userId || !profileIds.includes(userId)) continue
    paymentTotals.set(userId, (paymentTotals.get(userId) || 0) + Number(attempt.amount_uzs || 0))
  }

  const rows = profiles.map((profile: any) => {
    const telegram = telegramByProfile.get(profile.id)
    const telegramName = [telegram?.first_name, telegram?.last_name].filter(Boolean).join(' ').trim() || null
    return {
      id: profile.profile_code || profile.id,
      name: profile.full_name || profile.company_name || 'Nomsiz mijoz',
      telegram_name: telegramName,
      telegram_username: telegram?.username || null,
      telegram_id: telegram?.telegram_id || null,
      phone: profile.phone || null,
      account_type: profile.account_type || null,
      listing_count: listingCounts.get(profile.id) || 0,
      paid_total_uzs: paymentTotals.get(profile.id) || 0,
    }
  })

  return rows.filter(row => payment === 'paid' ? row.paid_total_uzs > 0 : payment === 'unpaid' ? row.paid_total_uzs === 0 : true)
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const rows = await loadCustomers(request)
    const exportMode = request.nextUrl.searchParams.get('export') === 'csv'

    if (exportMode) {
      const headers = ['Ismi familiyasi', 'Telegramdagi ismi', 'Telegram username', 'Telegram ID', 'Telefon raqami', 'ID raqami', 'E’lonlari soni', 'Monetizatsiyaga to‘lagan puli']
      const body = [
        headers,
        ...rows.map(row => [
          row.name,
          row.telegram_name || '',
          row.telegram_username ? '@' + row.telegram_username.replace(/^@/, '') : '',
          row.telegram_id || '',
          row.phone || '',
          row.id,
          row.listing_count,
          row.paid_total_uzs,
        ]),
      ].map(row => row.map(csvCell).join(';')).join('\r\n')

      return new NextResponse('\uFEFF' + body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="royalhouse-mijozlar.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({ rows, total: rows.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Mijozlar ro‘yxatini yuklashda xatolik' }, { status: 500 })
  }
}
