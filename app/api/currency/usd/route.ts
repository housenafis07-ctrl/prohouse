import { NextResponse } from 'next/server'

export const revalidate = 3600

type CbuRate = {
  Ccy?: string
  Nominal?: string
  Rate?: string
  Date?: string
}

export async function GET() {
  try {
    const response = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`CBU returned ${response.status}`)

    const rows = await response.json() as CbuRate[]
    const usd = Array.isArray(rows) ? rows.find(row => row.Ccy === 'USD') : null
    const nominal = Number(usd?.Nominal || 1)
    const rate = Number(String(usd?.Rate || '').replace(',', '.')) / nominal

    if (!usd || !Number.isFinite(rate) || rate <= 0 || !usd.Date) {
      throw new Error('CBU USD rate is missing or invalid')
    }

    return NextResponse.json(
      { currency: 'USD', rate, date: usd.Date, source: 'O‘zbekiston Respublikasi Markaziy banki' },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch (error) {
    console.error('[currency-usd] CBU rate unavailable', error)
    return NextResponse.json(
      { error: 'USD kursini hozir olish imkoni bo‘lmadi. Keyinroq qayta urinib ko‘ring.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
