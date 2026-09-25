'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Day = { date: string; status: 'free' | 'blocked' | 'booked'; price: number | null; priceType?: 'date' | 'weekend' | 'weekday' | 'base' }
type Review = { id: string; rating: number; body: string | null; created_at: string }
type RentalSettings = {
  max_guests?: string
  bedrooms?: string
  single_beds?: string
  double_beds?: string
  bathrooms?: string
  check_in?: string
  check_out?: string
  quiet_hours?: string
  amenities?: string[]
  policies?: string[]
  blocked_dates?: string[]
  date_prices?: Record<string, string>
  weekday_price?: string
  weekend_price?: string
  deposit_percent?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (date: string, amount: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10) }
const parse = (value: unknown): RentalSettings => { try { return typeof value === 'string' ? JSON.parse(value || '{}') : (value && typeof value === 'object' ? value as RentalSettings : {}) } catch { return {} } }
const formatMoney = (value: number, currency: string, ru: boolean) => `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(value)} ${currency === 'USD' ? '$' : ru ? 'сум' : 'so‘m'}`
const isWeekend = (date: string) => { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day === 0 || day === 6 }

export default function RentalBookingCalendar({ listingId, settingsValue, basePrice, currency, ru = false }: { listingId: string; settingsValue: string; basePrice: number; currency: string; ru?: boolean }) {
  const [days, setDays] = useState<Day[]>([])
  const [month, setMonth] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [guests, setGuests] = useState('1')
  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState('')
  const [reviews, setReviews] = useState<Review[]>([])
  const settings = useMemo(() => parse(settingsValue), [settingsValue])
  const depositPercent = Number(settings.deposit_percent || 15)
  const dayMap = useMemo(() => new Map(days.map(day => [day.date, day])), [days])

  const load = async () => {
    setLoading(true)
    try {
      const from = new Date(month.getFullYear(), month.getMonth(), 1)
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)
      const response = await fetch(`/api/rentals/availability?listingId=${encodeURIComponent(listingId)}&from=${iso(from)}&to=${iso(to)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Availability error')
      setDays(data.days || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? 'Не удалось загрузить календарь.' : 'Kalendarni yuklab bo‘lmadi.'))
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [listingId, month.getFullYear(), month.getMonth()])

  useEffect(() => {
    let mounted = true
    const loadReviews = async () => {
      try {
        const db = createClient()
        const { data } = await db.from('listing_reviews').select('id,rating,body,created_at').eq('listing_id', listingId).eq('status', 'published').order('created_at', { ascending: false }).limit(6)
        if (mounted) setReviews((data || []) as Review[])
      } catch { if (mounted) setReviews([]) }
    }
    void loadReviews()
    return () => { mounted = false }
  }, [listingId])

  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array(offset).fill(null), ...Array.from({ length: totalDays }, (_, i) => {
      const date = iso(new Date(month.getFullYear(), month.getMonth(), i + 1))
      return dayMap.get(date) || { date, status: 'free' as const, price: basePrice, priceType: 'base' as const }
    })]
  }, [month, dayMap, basePrice])

  const selectedRange = useMemo(() => {
    if (!checkIn || !checkOut) return []
    const range: string[] = []
    for (let date = checkIn; date < checkOut; date = addDays(date, 1)) range.push(date)
    return range
  }, [checkIn, checkOut])

  const nights = selectedRange.length
  const total = selectedRange.reduce((sum, date) => sum + Number(dayMap.get(date)?.price ?? basePrice), 0)
  const deposit = Math.round(total * depositPercent / 100)

  const chooseDate = (day: Day) => {
    if (day.status !== 'free') return
    setMessage('')
    if (!checkIn || (checkIn && checkOut)) { setCheckIn(day.date); setCheckOut(null); return }
    if (day.date <= checkIn) { setCheckIn(day.date); setCheckOut(null); return }
    const range: string[] = []
    for (let date = checkIn; date < day.date; date = addDays(date, 1)) range.push(date)
    const unavailable = range.some(date => { const item = dayMap.get(date); return item && item.status !== 'free' })
    if (unavailable) { setMessage(ru ? 'В выбранном диапазоне есть занятые даты.' : 'Tanlangan oraliqda band sana bor.'); return }
    setCheckOut(day.date)
  }

  const submit = async () => {
    if (!checkIn || !checkOut) { setMessage(ru ? 'Сначала выберите заезд и выезд.' : 'Avval kirish va chiqish sanalarini tanlang.'); return }
    if (checkOut <= checkIn) { setMessage(ru ? 'Дата выезда должна быть позже даты заезда.' : 'Chiqish sanasi kirish sanasidan keyin bo‘lishi kerak.'); return }
    setBooking(true); setMessage('')
    try {
      const response = await fetch('/api/rentals/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, checkIn, checkOut, guests: Number(guests), paymentProvider: 'pending' }) })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.href = `/register?redirect=${encodeURIComponent(window.location.pathname)}`; return }
      if (!response.ok) throw new Error(data.error || (ru ? 'Ошибка бронирования.' : 'Bron qilishda xatolik.'))
      setMessage(ru ? `Запрос на бронь создан. Аванс ${formatMoney(Number(data.depositAmount || deposit), data.currency || currency, true)}.` : `Bron so‘rovi yaratildi. Avans ${formatMoney(Number(data.depositAmount || deposit), data.currency || currency, false)}.`)
      setCheckIn(null); setCheckOut(null); void load()
    } catch (error) { setMessage(error instanceof Error ? error.message : (ru ? 'Ошибка бронирования.' : 'Bron qilishda xatolik.')) }
    finally { setBooking(false) }
  }

  const monthName = month.toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ', { month: 'long', year: 'numeric' })
  const avgRating = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0
  const amenities = settings.amenities || []
  const amenityNames: Record<string, string> = { pool: 'Ochiq hovuz', indoor_pool: 'Yopiq hovuz', wifi: 'Wi‑Fi', parking: 'Avtoturargoh', kitchen: 'Oshxona', bbq: 'Barbekyu', karaoke: 'Karaoke', billiard: 'Bilyard', tennis: 'Stol tennisi', sauna: 'Sauna', playground: 'Bolalar maydonchasi', jacuzzi: 'Jakuzi' }

  return <section className="mt-8 space-y-5">
    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-black">{ru ? 'Календарь и бронирование' : 'Kalendar va bron qilish'}</h2><p className="mt-1 text-sm text-slate-500">{ru ? 'Выберите дату заезда и дату выезда. Цена указана за 1 ночь.' : 'Kirish va chiqish sanasini tanlang. Narx 1 kecha uchun ko‘rsatiladi.'}</p></div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm"><b>{depositPercent}% {ru ? 'предоплата' : 'avans'}</b><div className="text-xs text-slate-500">{ru ? 'Остаток — при заезде' : 'Qolgan summa — kirishda'}</div></div>
      </div>

      <div className="mt-5 rounded-2xl border p-4">
        <div className="flex items-center justify-between"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border px-3 py-1">‹</button><b className="capitalize">{monthName}</b><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border px-3 py-1">›</button></div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">{['DU','SE','CHO','PA','JU','SHA','YA'].map(x => <span key={x}>{x}</span>)}</div>
        {loading ? <div className="py-10 text-center text-sm text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div> : <div className="mt-1 grid grid-cols-7 gap-1">{grid.map((day, index) => day ? <button type="button" key={day.date} onClick={() => chooseDate(day)} disabled={day.status !== 'free'} className={`min-h-16 rounded-lg border p-1 text-left transition ${day.status === 'booked' ? 'bg-red-50 text-red-500' : day.status === 'blocked' ? 'bg-slate-100 text-slate-400' : isWeekend(day.date) ? 'bg-amber-50 text-slate-800' : 'bg-emerald-50 text-slate-800'} ${selectedRange.includes(day.date) ? 'ring-2 ring-slate-950' : ''} ${checkIn === day.date ? 'ring-2 ring-blue-600' : ''}`}><div className="text-xs font-bold">{Number(day.date.slice(-2))}</div><div className="mt-1 text-[9px]">{day.status === 'booked' ? (ru ? 'Занято' : 'Band') : day.status === 'blocked' ? (ru ? 'Закрыто' : 'Yopiq') : `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(Number(day.price || 0))} ${currency === 'USD' ? '$' : ru ? 'сум' : 'so‘m'}`}</div></button> : <span key={index} />)}</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs"><span>🟢 {ru ? 'Свободно' : 'Bo‘sh'}</span><span>🟡 {ru ? 'Выходные' : 'Dam olish kuni'}</span><span>🔴 {ru ? 'Забронировано' : 'Band'}</span><span>⚪ {ru ? 'Закрыто' : 'Yopiq'}</span></div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_190px] lg:items-end">
        <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">{ru ? 'Заезд' : 'Kirish'}</div><b className="mt-1 block">{checkIn || (ru ? 'Выберите дату' : 'Sanani tanlang')}</b></div>
        <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">{ru ? 'Выезд' : 'Chiqish'}</div><b className="mt-1 block">{checkOut || (ru ? 'Выберите дату' : 'Sanani tanlang')}</b></div>
        <label className="text-sm font-semibold">{ru ? 'Гости' : 'Mehmonlar'}<input type="number" min="1" max={Number(settings.max_guests || 99)} value={guests} onChange={e => setGuests(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{ru ? 'Ночей' : 'Tunlar'}</div><b className="text-lg">{nights}</b></div><div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{ru ? 'При заезде' : 'Kirishda'}</div><b className="text-lg">{formatMoney(total - deposit, currency, ru)}</b></div><div className="rounded-xl bg-amber-50 p-4"><div className="text-xs text-slate-500">{ru ? 'Предоплата' : 'Avans'}</div><b className="text-lg">{formatMoney(deposit, currency, ru)}</b></div></div>
      <button type="button" onClick={submit} disabled={booking || !checkIn || !checkOut} className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-40">{booking ? (ru ? 'Создание брони...' : 'Bron yaratilmoqda...') : (ru ? 'Забронировать и перейти к оплате аванса' : 'Joyni bron qilish va avans to‘lash')}</button>
      {message && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{message}</div>}
      <p className="mt-4 text-xs text-slate-500">{ru ? 'Бронь сначала создаётся как запрос. Payme/Click подключаются через платёжный провайдер проекта.' : 'Bron avval so‘rov sifatida yaratiladi. Payme/Click loyiha to‘lov provayderi orqali ulanadi.'}</p>
    </div>

    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-black">{ru ? 'Информация о даче' : 'Dacha haqida'}</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{ru ? 'Гостей' : 'Mehmonlar'}</span><b className="mt-1 block">{settings.max_guests || '—'}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{ru ? 'Спален' : 'Yotoqxonalar'}</span><b className="mt-1 block">{settings.bedrooms || '—'}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{ru ? 'Кроватей' : 'Yotoqlar'}</span><b className="mt-1 block">{Number(settings.single_beds || 0) + Number(settings.double_beds || 0) || '—'}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-400">{ru ? 'Санузлов' : 'Hammom/WC'}</span><b className="mt-1 block">{settings.bathrooms || '—'}</b></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3 text-sm"><span className="text-slate-400">{ru ? 'Заезд' : 'Kirish'}</span><b className="mt-1 block">{settings.check_in || '—'}</b></div><div className="rounded-xl border p-3 text-sm"><span className="text-slate-400">{ru ? 'Выезд' : 'Chiqish'}</span><b className="mt-1 block">{settings.check_out || '—'}</b></div><div className="rounded-xl border p-3 text-sm"><span className="text-slate-400">{ru ? 'Тихие часы' : 'Sokin soatlar'}</span><b className="mt-1 block">{settings.quiet_hours || '—'}</b></div></div>{amenities.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{amenities.map(item => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{amenityNames[item] || item}</span>)}</div>}</div>

    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{ru ? 'Отзывы гостей' : 'Mehmonlar sharhlari'}</h2><p className="mt-1 text-sm text-slate-500">{reviews.length ? `★ ${avgRating.toFixed(1)} · ${reviews.length} ${ru ? 'отзывов' : 'ta sharh'}` : (ru ? 'Пока нет опубликованных отзывов.' : 'Hozircha e’lon qilingan sharhlar yo‘q.')}</p></div>{reviews.length > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">★ {avgRating.toFixed(1)}</span>}</div>{reviews.length > 0 && <div className="mt-5 space-y-3">{reviews.map(review => <article key={review.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><b>★ {review.rating}/5</b><span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')}</span></div>{review.body && <p className="mt-2 text-sm leading-6 text-slate-600">{review.body}</p>}</article>)}</div>}</div>
  </section>
}
