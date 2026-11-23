import { NextResponse } from 'next/server'

export const revalidate = 21600

type CbuRate = {
  Ccy?: string
  Nominal?: string
  Rate?: string
  Date?: string
  CcyNm_UZ?: string
}

const CURRENCIES = ['USD', 'EUR', 'RUB', 'CNY'] as const

export async function GET() {
  try {
    const response = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`CBU returned ${response.status}`)

    const rows = await response.json() as CbuRate[]
    if (!Array.isArray(rows)) throw new Error('CBU response is not an array')

    const rates = Object.fromEntries(CURRENCIES.map(code => {
      const item = rows.find(row => row.Ccy === code)
      const nominal = Number(item?.Nominal || 1)
      const rate = Number(String(item?.Rate || '').replace(',', '.')) / nominal
      if (!item || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`CBU rate missing for ${code}`)
      }
      return [code, { rate, date: item.Date || '', name: item.CcyNm_UZ || code }]
    }))

    const date = rows.find(row => row.Date)?.Date || ''
    if (!date) throw new Error('CBU rate date is missing')

    return NextResponse.json(
      { rates, date, source: 'O‘zbekiston Respublikasi Markaziy banki' },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=604800' } },
    )
  } catch (error) {
    console.error('[currency-rates] CBU rates unavailable', error)
    return NextResponse.json(
      { error: 'Markaziy bank kurslarini hozir olish imkoni bo‘lmadi.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
