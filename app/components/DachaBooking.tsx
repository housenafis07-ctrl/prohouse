'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

 type Props = { listingId: string; currency: string; lang: 'uz' | 'ru' }
 type CalendarData = {
  listing: { weekdayPrice: number; weekendPrice: number; maxGuests: number | null }
  unavailable: { start: string; end: string; status: string; bookingId?: string }[]
  blocked: { id: string; start_date: string; end_date: string; reason: string | null }[]
  ownerView: boolean
  bookings: { id: string; check_in: string; check_out: string; guests: number; total_amount: number; currency: string; status: string; guest?: { full_name: string | null; phone: string | null } | null }[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const money = (value: number, currency: string, lang: 'uz' | 'ru') => `${new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(value)} ${currency === 'USD' ? '$' : lang === 'ru' ? 'сум' : 'so‘m'}`

function inRange(day: string, start: string, end: string) {
  return day >= start && day < end
}

function monthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const total = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= total; day += 1) cells.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

export default function DachaBooking({ listingId, currency, lang }: Props) {
  const router = useRouter()
  const [month, setMonth] = useState(() => new Date())
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null)

  const text = lang === 'ru'
    ? { title: 'Календарь доступности и бронирование', free: 'Свободно', busy: 'Занято', blocked: 'Закрыто владельцем', selectHint: 'Выберите свободные даты заезда и выезда.', checkIn: 'Заезд', checkOut: 'Выезд', guests: 'Гостей', note: 'Комментарий', notePlaceholder: 'Например: семейный отдых, время приезда...', book: 'Запросить бронирование', booking: 'Отправляем...', login: 'Для бронирования войдите в аккаунт.', commission: 'Комиссия Royalhouse для дач — 15%', price: 'Цена за ночь', weekday: 'Будни', weekend: 'Выходные', ownerTitle: 'Управление календарём', block: 'Закрыть даты', blockBusy: 'Сохраняем...', bookings: 'Заявки на бронирование', confirm: 'Подтвердить', reject: 'Отклонить', cancel: 'Отменить', blockedRemove: 'Открыть даты', noBookings: 'Бронирований пока нет', noBlocked: 'Закрытых дат нет', statusPending: 'Ожидает', statusConfirmed: 'Подтверждено', statusRejected: 'Отклонено', statusCancelled: 'Отменено', error: 'Не удалось загрузить календарь.' }
    : { title: 'Bo‘sh kunlar va bronlash', free: 'Bo‘sh', busy: 'Band', blocked: 'Egasi yopgan', selectHint: 'Bo‘sh kunlardan kirish va chiqish sanasini tanlang.', checkIn: 'Kirish', checkOut: 'Chiqish', guests: 'Mehmonlar', note: 'Izoh', notePlaceholder: 'Masalan: oilaviy dam olish, kelish vaqti...', book: 'Bron so‘rovini yuborish', booking: 'Yuborilmoqda...', login: 'Bronlash uchun shaxsiy kabinetga kiring.', commission: 'Dachalar uchun Royalhouse komissiyasi — 15%', price: 'Bir kechalik narx', weekday: 'Ish kunlari', weekend: 'Dam olish kunlari', ownerTitle: 'Kalendarni boshqarish', block: 'Sanalarni yopish', blockBusy: 'Saqlanmoqda...', bookings: 'Bron so‘rovlari', confirm: 'Tasdiqlash', reject: 'Rad etish', cancel: 'Bekor qilish', blockedRemove: 'Sanani ochish', noBookings: 'Hali bron so‘rovlari yo‘q', noBlocked: 'Yopilgan sanalar yo‘q', statusPending: 'Kutilmoqda', statusConfirmed: 'Tasdiqlangan', statusRejected: 'Rad etilgan', statusCancelled: 'Bekor qilingan', error: 'Kalendarni yuklab bo‘lmadi.' }

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/dacha/bookings?listingId=${encodeURIComponent(listingId)}&month=${monthKey(month)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || text.error)
      setData(result)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : text.error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [listingId, month])

  const cells = useMemo(() => monthDays(month), [month])
  const unavailable = data?.unavailable || []
  const blocked = data?.blocked || []
  const isUnavailable = (day: string) => unavailable.some(range => inRange(day, range.start, range.end)) || blocked.some(range => inRange(day, range.start_date, range.end_date))
  const priceFor = (day: string) => {
    const weekday = new Date(`${day}T00:00:00`).getDay()
    return weekday === 0 || weekday === 6 ? data?.listing.weekendPrice || 0 : data?.listing.weekdayPrice || 0
  }

  const selectDay = (day: string) => {
    if (data?.ownerView || isUnavailable(day) || day < iso(new Date())) return
    if (!checkIn || (checkIn && checkOut)) { setCheckIn(day); setCheckOut(''); return }
    if (day <= checkIn) { setCheckIn(day); setCheckOut(''); return }
    const cursor = new Date(`${checkIn}T00:00:00`)
    const end = new Date(`${day}T00:00:00`)
    while (cursor < end) {
      const current = iso(cursor)
      if (isUnavailable(current)) { setCheckIn(day); setCheckOut(''); return }
      cursor.setDate(cursor.getDate() + 1)
    }
    setCheckOut(day)
  }

  const submitBooking = async () => {
    if (!checkIn || !checkOut) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/dacha/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, checkIn, checkOut, guests: Number(guests), note }) })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) { router.push(`/register?redirect=/listings/${listingId}`); return }
      if (!response.ok) throw new Error(result.error || text.error)
      setCheckIn(''); setCheckOut(''); setNote(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : text.error) } finally { setBusy(false) }
  }

  const ownerAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/dacha/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, ...body }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || text.error)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : text.error) } finally { setBusy(false) }
  }

  const statusLabel = (status: string) => status === 'confirmed' ? text.statusConfirmed : status === 'rejected' ? text.statusRejected : status === 'cancelled' ? text.statusCancelled : text.statusPending

  return <section className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-black">{data?.ownerView ? text.ownerTitle : text.title}</h2><p className="mt-1 text-sm text-slate-500">{text.selectHint}</p></div>
      {!data?.ownerView && <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{text.commission}</span>}
    </div>
    {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-xl border bg-white px-3 py-2 font-bold">‹</button><b>{new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: 'long', year: 'numeric' }).format(month)}</b><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-xl border bg-white px-3 py-2 font-bold">›</button></div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">{(lang === 'ru' ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Du','Se','Cho','Pa','Ju','Sha','Ya']).map(day => <span key={day} className="py-2">{day}</span>)}</div>
        {loading ? <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">{text.booking}</div> : <div className="grid grid-cols-7 gap-1">{cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="min-h-16 rounded-xl bg-slate-50/50 sm:min-h-20" />
          const unavailableDay = isUnavailable(day)
          const selectedDay = day === checkIn || day === checkOut || (checkIn && checkOut && day > checkIn && day < checkOut)
          const past = day < iso(new Date())
          return <button key={day} type="button" disabled={Boolean(data?.ownerView) || unavailableDay || past} onClick={() => selectDay(day)} className={`min-h-16 rounded-xl border p-1.5 text-left transition sm:min-h-20 ${unavailableDay ? 'cursor-not-allowed border-red-100 bg-red-50 text-red-400' : selectedDay ? 'border-emerald-500 bg-emerald-50' : past ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white hover:border-emerald-400'}`}><span className="block text-sm font-black">{Number(day.slice(-2))}</span>{!unavailableDay && !past && <span className="mt-2 block truncate text-[10px] font-bold text-slate-400">{money(priceFor(day), currency, lang)}</span>}{unavailableDay && <span className="mt-2 block text-[10px] font-bold">{text.busy}</span>}</button>
        })}</div>}
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500"><span>🟢 {text.free}</span><span>🔴 {text.busy}</span><span>⚪ {text.blocked}</span></div>
      </div>

      {!data?.ownerView ? <div className="rounded-2xl border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><label className="text-xs font-bold text-slate-500">{text.checkIn}<input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); setCheckOut('') }} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="text-xs font-bold text-slate-500">{text.checkOut}<input type="date" min={checkIn || undefined} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="text-xs font-bold text-slate-500">{text.guests}<input type="number" min="1" max={data?.listing.maxGuests || undefined} value={guests} onChange={e => setGuests(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="text-xs font-bold text-slate-500 sm:col-span-2 lg:col-span-1">{text.note}<textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder={text.notePlaceholder} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label></div>
        {checkIn && checkOut && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{text.checkIn}: {checkIn} · {text.checkOut}: {checkOut}</div>}
        <button type="button" disabled={!checkIn || !checkOut || busy} onClick={() => void submitBooking()} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? text.booking : text.book}</button>
      </div> : <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{text.block}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2"><input type="date" value={blockStart} onChange={e => setBlockStart(e.target.value)} className="rounded-xl border p-3 text-sm"/><input type="date" min={blockStart || undefined} value={blockEnd} onChange={e => setBlockEnd(e.target.value)} className="rounded-xl border p-3 text-sm"/></div><button type="button" disabled={!blockStart || !blockEnd || busy} onClick={() => void ownerAction({ action: 'block', startDate: blockStart, endDate: blockEnd })} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? text.blockBusy : text.block}</button></div>
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{text.bookings}</h3>{data.bookings.length === 0 ? <p className="mt-3 text-sm text-slate-500">{text.noBookings}</p> : <div className="mt-3 space-y-2">{data.bookings.map(booking => <div key={booking.id} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><b>{booking.check_in} → {booking.check_out}</b><span className="rounded-full bg-white px-2 py-1 font-bold">{statusLabel(booking.status)}</span></div><p className="mt-1">{booking.guest?.full_name || '—'} · {booking.guests} {lang === 'ru' ? 'гостей' : 'mehmon'}</p><p className="mt-1 font-bold">{money(Number(booking.total_amount), booking.currency, lang)}</p>{booking.status === 'pending' && <div className="mt-2 flex gap-2"><button onClick={() => void ownerAction({ action: 'status', bookingId: booking.id, status: 'confirmed' })} disabled={busy} className="rounded-lg bg-emerald-600 px-2 py-1 font-bold text-white">{text.confirm}</button><button onClick={() => void ownerAction({ action: 'status', bookingId: booking.id, status: 'rejected' })} disabled={busy} className="rounded-lg border border-red-200 bg-white px-2 py-1 font-bold text-red-600">{text.reject}</button></div>}</div>)}</div>}</div>
        <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{text.blockedRemove}</h3>{blocked.length === 0 ? <p className="mt-3 text-sm text-slate-500">{text.noBlocked}</p> : <div className="mt-3 space-y-2">{blocked.map(block => <div key={block.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span>{block.start_date} → {block.end_date}</span><button onClick={() => void ownerAction({ action: 'unblock', blockId: block.id })} disabled={busy} className="rounded-lg border bg-white px-2 py-1 font-bold">{text.blockedRemove}</button></div>)}</div>}</div>
      </div>}
    </div>
  </section>
}
