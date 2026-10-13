'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Booking = {
  id: string; bookingNumber: string; role: 'customer' | 'partner'; checkIn: string; checkOut: string; guests: number
  currency: string; totalAmount: number; depositAmount: number; depositPercent: number; paymentStatus: string; status: string; createdAt: string; paidAt: string | null
  providerPaymentId: string | null; paymeAmount: number | null
  listing: { id: string; title: string; titleRu: string | null; image: string | null; city: string; district: string | null } | null
  guest: { name: string | null; phone: string | null } | null
}
type PartnerListing = { id: string; title: string; titleRu: string | null; image: string | null; city: string; district: string | null }
type ViewMode = 'list' | 'calendar'
const money = (value: number, ru: boolean) => `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(value)} ${ru ? 'сум' : 'so‘m'}`
const date = (value: string, ru: boolean) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Tashkent' }).format(new Date(value + 'T12:00:00+05:00'))
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (value: string, count: number) => { const d = new Date(value + 'T12:00:00'); d.setDate(d.getDate()+count); return isoDate(d) }
const isBetween = (day: string, start: string, end: string) => day >= start && day < end

export default function RentalBookingsPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [items, setItems] = useState<Booking[]>([])
  const [partnerListings, setPartnerListings] = useState<PartnerListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [audience, setAudience] = useState<'partner' | 'customer'>('partner')
  const [listingId, setListingId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const [month, setMonth] = useState(() => new Date())
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const auth = createClient()
      const { data: { user } } = await auth.auth.getUser()
      if (!user) { router.replace('/register?next=%2Faccount%2Fbookings'); return }
      const response = await fetch('/api/account/rental-bookings', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось загрузить бронирования.' : 'Bronlarni yuklab bo‘lmadi.'))
      setItems(data.bookings || [])
      setPartnerListings(data.partnerListings || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : (ru ? 'Не удалось загрузить бронирования.' : 'Bronlarni yuklab bo‘lmadi.'))
    } finally { setLoading(false) }
  }, [router, ru])
  useEffect(() => { void load() }, [load])

  const partnerItems = useMemo(() => items.filter(x => x.role === 'partner'), [items])
  const customerItems = useMemo(() => items.filter(x => x.role === 'customer'), [items])
  const visible = useMemo(() => (audience === 'partner' ? partnerItems : customerItems).filter(item => {
    if (audience === 'partner' && listingId !== 'all' && item.listing?.id !== listingId) return false
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid' && item.paymentStatus !== 'paid') return false
      if (statusFilter === 'pending' && !(item.status === 'pending_payment' || item.paymentStatus === 'pending' || item.paymentStatus === 'processing')) return false
      if (statusFilter === 'cancelled' && item.status !== 'cancelled') return false
      if (statusFilter === 'confirmed' && item.status !== 'confirmed') return false
    }
    if (from && item.checkOut <= from) return false
    if (to && item.checkIn > to) return false
    const haystack = [item.bookingNumber, item.listing?.title, item.listing?.titleRu, item.guest?.name, item.guest?.phone].join(' ').toLocaleLowerCase()
    return !query || haystack.includes(query.toLocaleLowerCase())
  }), [audience, partnerItems, customerItems, listingId, statusFilter, from, to, query])

  const selectedDacha = listingId === 'all' ? null : partnerListings.find(x => x.id === listingId) || null
  const confirmed = visible.filter(x => x.status === 'confirmed')
  const paid = visible.filter(x => x.paymentStatus === 'paid')
  const pending = visible.filter(x => x.status === 'pending_payment' || x.paymentStatus === 'pending' || x.paymentStatus === 'processing')
  const cancelled = visible.filter(x => x.status === 'cancelled')
  const actualPaid = paid.reduce((sum, x) => sum + x.depositAmount, 0)
  const totalBookingValue = confirmed.reduce((sum, x) => sum + x.totalAmount, 0)
  const pendingAdvance = pending.reduce((sum, x) => sum + x.depositAmount, 0)
  const allTimeDachaItems = listingId === 'all' ? partnerItems : partnerItems.filter(x => x.listing?.id === listingId)
  const dachaPaid = allTimeDachaItems.filter(x => x.paymentStatus === 'paid').reduce((sum, x) => sum + x.depositAmount, 0)

  const statusLabel = (item: Booking) => {
    if (item.status === 'cancelled') return ru ? 'Отменено' : 'Bekor qilingan'
    if (item.paymentStatus === 'paid') return ru ? 'Аванс оплачен' : 'Avans to‘langan'
    if (item.paymentStatus === 'processing') return ru ? 'Проверяется оплата' : 'To‘lov tekshirilmoqda'
    if (item.status === 'pending_payment') return ru ? 'Ожидает оплаты' : 'To‘lov kutilmoqda'
    return ru ? 'Не оплачено' : 'To‘lanmagan'
  }
  const exportCsv = () => {
    const headers = ru
      ? ['Номер брони','Дача','Клиент','Телефон','Заезд','Выезд','Гости','Полная стоимость','Аванс','Оплаченный аванс','Статус брони','Статус оплаты']
      : ['Bron raqami','Dacha','Mijoz','Telefon','Kirish','Chiqish','Mehmonlar','Jami narx','Avans','To‘langan avans','Bron holati','To‘lov holati']
    const rows = visible.map(x => [x.bookingNumber, x.listing?.title || '', x.guest?.name || '', x.guest?.phone || '', x.checkIn, x.checkOut, x.guests, x.totalAmount, x.depositAmount, x.paymentStatus === 'paid' ? x.depositAmount : 0, x.status, x.paymentStatus])
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `dacha-bronlar-${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const selectedMonthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const count = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate()
    return [...Array(offset).fill(null), ...Array.from({length: count}, (_, i) => isoDate(new Date(month.getFullYear(), month.getMonth(), i+1)))] as (string | null)[]
  }, [month])
  const bookingsForDay = (day: string) => visible.filter(x => x.status !== 'cancelled' && isBetween(day, x.checkIn, x.checkOut))
  const dayLabels = ru ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Du','Se','Cho','Pa','Ju','Sha','Ya']

  return <main className="min-h-[65vh] bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-6xl">
    <Link href="/account" className="text-sm font-bold text-emerald-700">{ru ? '← Личный кабинет' : '← Shaxsiy kabinet'}</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{ru ? 'Аренда' : 'Ijara'}</p><h1 className="mt-1 text-3xl font-black text-slate-900">{ru ? 'Бронирования дач' : 'Dacha bronlari'}</h1><p className="mt-2 text-sm text-slate-500">{ru ? 'Управляйте объявлениями, календарём и поступившими авансами.' : 'Dachalar, kalendar va tushgan avanslarni bir joydan boshqaring.'}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">{ru ? 'Обновить' : 'Yangilash'}</button>{audience === 'partner' && <button onClick={exportCsv} disabled={!visible.length} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{ru ? 'Экспорт CSV' : 'CSV yuklab olish'}</button>}</div></div>

    <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => setAudience('partner')} className={`rounded-xl px-4 py-2 text-sm font-bold ${audience==='partner'?'bg-emerald-700 text-white':'border border-slate-200 bg-white text-slate-700'}`}>{ru ? 'Мои дачи и брони' : 'Dachalarim va bronlar'}</button><button onClick={() => setAudience('customer')} className={`rounded-xl px-4 py-2 text-sm font-bold ${audience==='customer'?'bg-emerald-700 text-white':'border border-slate-200 bg-white text-slate-700'}`}>{ru ? 'Мои брони как гостя' : 'Men qilgan bronlar'}</button></div>

    {loading ? <div className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div> : error ? <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : <>
      {audience === 'partner' && <>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label={ru?'Мои дачи':'Dachalarim'} value={String(partnerListings.length)} note={ru?'Объявления':'E’lonlar'} />
          <Metric label={ru?'Оплаченные авансы':'To‘langan avanslar'} value={money(actualPaid,ru)} note={ru?'Только подтверждённые оплаты':'Faqat tasdiqlangan to‘lovlar'} />
          <Metric label={ru?'Ожидаемый аванс':'Kutilayotgan avans'} value={money(pendingAdvance,ru)} note={ru?'Не считается доходом':'Daromad hisoblanmaydi'} />
          <Metric label={ru?'Стоимость подтверждённых броней':'Tasdiqlangan bronlar qiymati'} value={money(totalBookingValue,ru)} note={ru?`${confirmed.length} броней`:`${confirmed.length} ta bron`} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partnerListings.map(listing => {
            const related = partnerItems.filter(x => x.listing?.id === listing.id)
            const paidAmount = related.filter(x => x.paymentStatus === 'paid').reduce((sum,x)=>sum+x.depositAmount,0)
            const due = related.filter(x => x.status === 'pending_payment' || x.paymentStatus === 'pending' || x.paymentStatus === 'processing').length
            return <button key={listing.id} onClick={() => {setListingId(listing.id);setAudience('partner')}} className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-emerald-300 ${listingId===listing.id?'border-emerald-500 ring-1 ring-emerald-200':'border-slate-200'}`}>
              {listing.image ? <img src={listing.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">RH</div>}
              <span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-900">{ru?(listing.titleRu||listing.title):listing.title}</b><span className="mt-1 block text-xs text-slate-500">{related.length} {ru?'броней':'ta bron'} · {due} {ru?'ожидают':'kutilmoqda'}</span><span className="mt-1 block truncate text-xs font-bold text-emerald-700">{ru?'Авансы получены':'Tushgan avans'}: {money(paidAmount,ru)}</span></span>
            </button>
          })}
          {partnerListings.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">{ru?'У вас пока нет дачных объявлений.':'Hozircha dacha e’lonlaringiz yo‘q.'}</div>}
        </div>
      </>}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {audience === 'partner' && <label className="text-xs font-bold text-slate-500">{ru?'Дача':'Dacha'}<select value={listingId} onChange={e=>setListingId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"><option value="all">{ru?'Все дачи':'Barcha dachalar'}</option>{partnerListings.map(x=><option key={x.id} value={x.id}>{ru?(x.titleRu||x.title):x.title}</option>)}</select></label>}
          <label className="text-xs font-bold text-slate-500">{ru?'Статус':'Holat'}<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"><option value="all">{ru?'Все статусы':'Barcha holatlar'}</option><option value="paid">{ru?'Аванс оплачен':'Avans to‘langan'}</option><option value="pending">{ru?'Ожидает оплаты':'To‘lov kutilmoqda'}</option><option value="confirmed">{ru?'Подтверждено':'Tasdiqlangan'}</option><option value="cancelled">{ru?'Отменено':'Bekor qilingan'}</option></select></label>
          <label className="text-xs font-bold text-slate-500">{ru?'С даты заезда':'Kirish sanasi dan'}<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"/></label>
          <label className="text-xs font-bold text-slate-500">{ru?'По дате заезда':'Kirish sanasi gacha'}<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"/></label>
          <label className="text-xs font-bold text-slate-500">{ru?'Поиск':'Qidirish'}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ru?'Номер, клиент, телефон':'Bron raqami, mijoz, telefon'} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"/></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{ru?`Найдено: ${visible.length}`:`Topildi: ${visible.length} ta bron`}</p><div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button onClick={()=>setView('list')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view==='list'?'bg-white shadow-sm':'text-slate-500'}`}><span className="inline-flex items-center gap-1">☷ {ru?'Список':'Ro‘yxat'}</span></button><button onClick={()=>setView('calendar')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view==='calendar'?'bg-white shadow-sm':'text-slate-500'}`}>▦ {ru?'Календарь':'Kalendar'}</button></div></div>
      </section>

      {view === 'calendar' && <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className="rounded-lg border px-3 py-2 font-bold" aria-label={ru?'Предыдущий месяц':'Oldingi oy'}>‹</button><h2 className="font-black capitalize">{month.toLocaleDateString(ru?'ru-RU':'uz-UZ',{month:'long',year:'numeric'})}</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className="rounded-lg border px-3 py-2 font-bold" aria-label={ru?'Следующий месяц':'Keyingi oy'}>›</button></div>
        <div className="mt-4 grid grid-cols-7 gap-1">{dayLabels.map(x=><div key={x} className="py-2 text-center text-xs font-bold text-slate-400">{x}</div>)}{selectedMonthDays.map((day,i)=>{if(!day)return <div key={`blank-${i}`}/>;const active=bookingsForDay(day);return <div key={day} className={`min-h-16 rounded-lg border p-1 sm:min-h-20 sm:p-2 ${active.length?'border-amber-200 bg-amber-50':'border-slate-100 bg-slate-50'}`}><span className="text-xs font-bold text-slate-700">{Number(day.slice(-2))}</span>{active.length>0&&<span className="mt-1 block text-[10px] font-bold text-amber-800 sm:text-xs">{active.length} {ru?'бр.':'bron'}</span>}{active.slice(0,2).map(x=><Link key={x.id} href={`/account/bookings/${x.id}`} className="mt-1 block truncate text-[9px] text-slate-600 underline sm:text-[10px]">{x.listing?.title||x.bookingNumber}</Link>)}</div>})}</div>
        <p className="mt-3 text-xs text-slate-500">{ru?'Календарь учитывает выбранные фильтры. Отменённые брони не блокируют даты.':'Kalendar tanlangan filtrlarni hisobga oladi. Bekor qilingan bronlar sanalarni band qilmaydi.'}</p>
      </section>}

      {view === 'list' && <section className="mt-4 space-y-2">
        {visible.length===0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ru?'По этим фильтрам бронирований нет.':'Tanlangan filtrlar bo‘yicha bron topilmadi.'}</div> : visible.map(item=><article key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
          {item.listing?.image ? <img src={item.listing.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 sm:h-20 sm:w-20">RH</div>}
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">#{item.bookingNumber}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status==='cancelled'?'bg-rose-50 text-rose-700':item.paymentStatus==='paid'?'bg-emerald-100 text-emerald-800':item.paymentStatus==='processing'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-600'}`}>{statusLabel(item)}</span></div>
            <h2 className="mt-1 truncate text-sm font-extrabold text-slate-900">{ru?(item.listing?.titleRu||item.listing?.title||'Дача'):(item.listing?.title||'Dacha')}</h2>
            <p className="mt-1 text-xs text-slate-600">{date(item.checkIn,ru)} — {date(item.checkOut,ru)} · {item.guests} {ru?'гостей':'mehmon'}</p>
            {audience==='partner'&&<p className="mt-1 truncate text-xs text-slate-500">{ru?'Клиент':'Mijoz'}: <b className="text-slate-700">{item.guest?.name||'—'} · {item.guest?.phone||'—'}</b></p>}
          </div>
          <div className="hidden shrink-0 text-right sm:block"><p className="text-[10px] text-slate-400">{ru?'Стоимость':'Jami narx'}</p><b className="text-sm text-slate-900">{money(item.totalAmount,ru)}</b><p className="mt-1 text-[10px] text-slate-500">{ru?'Аванс':'Avans'}: {money(item.depositAmount,ru)}</p><p className="text-[10px] font-bold text-emerald-700">{item.paymentStatus==='paid'?money(item.depositAmount,ru):money(0,ru)} {ru?'оплачено':'to‘langan'}</p></div>
          <Link href={`/account/bookings/${item.id}`} className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">{ru?'Подробнее':'Ochish'}</Link>
        </article>)}
      </section>}
      {audience==='partner'&&<p className="mt-4 text-xs leading-5 text-slate-500">{ru?'Финансовые показатели учитывают только платежи со статусом «Оплачено». Сумма брони не считается фактическим поступлением.':'Moliyaviy ko‘rsatkichlar faqat statusi to‘langan avanslarni hisoblaydi. Bronning umumiy summasi real tushum sifatida ko‘rsatilmaydi.'}</p>}
    </>}
  </div></main>
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 break-words text-lg font-black text-slate-900 sm:text-xl">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></div>}
