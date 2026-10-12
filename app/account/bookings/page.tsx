'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Booking = {
  id: string; bookingNumber: string; role: 'customer' | 'partner'; checkIn: string; checkOut: string; guests: number
  currency: string; totalAmount: number; depositAmount: number; paymentStatus: string; status: string; createdAt: string; paidAt: string | null
  providerPaymentId: string | null; paymeAmount: number | null
  listing: { id: string; title: string; titleRu: string | null; image: string | null; city: string; district: string | null } | null
  guest: { name: string | null; phone: string | null } | null
}
const money = (value: number, ru: boolean) => `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(value)} ${ru ? 'сум' : 'so‘m'}`
const date = (value: string, ru: boolean) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Tashkent' }).format(new Date(value + 'T12:00:00+05:00'))

export default function RentalBookingsPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [items, setItems] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const auth = createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) { router.replace('/register?next=%2Faccount%2Fbookings'); return }
    const response = await fetch('/api/account/rental-bookings', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) setError(data.error || (ru ? 'Не удалось загрузить бронирования.' : 'Bronlarni yuklab bo‘lmadi.'))
    else setItems(data.bookings || [])
    setLoading(false)
  }, [router, ru])
  useEffect(() => { void load() }, [load])

  const statusLabel = (status: string, payment: string) => {
    if (payment === 'paid') return ru ? 'Аванс оплачен' : 'Avans to‘langan'
    if (payment === 'processing') return ru ? 'Проверяется оплата' : 'To‘lov tekshirilmoqda'
    if (status === 'cancelled') return ru ? 'Отменено' : 'Bekor qilingan'
    if (status === 'pending_payment') return ru ? 'Ожидает оплаты' : 'To‘lov kutilmoqda'
    return ru ? 'Не оплачено' : 'To‘lanmagan'
  }

  return <main className="min-h-[65vh] bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-5xl">
    <Link href="/account" className="text-sm font-bold text-emerald-700">{ru ? '← Личный кабинет' : '← Shaxsiy kabinet'}</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{ru ? 'Аренда' : 'Ijara'}</p><h1 className="mt-1 text-3xl font-black text-slate-900">{ru ? 'Мои бронирования' : 'Mening bronlarim'}</h1><p className="mt-2 text-sm text-slate-500">{ru ? 'Брони как гостя и брони ваших дач как партнёра.' : 'Mijoz sifatidagi bronlaringiz va hamkor sifatida dachalaringiz bronlari.'}</p></div><button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{ru ? 'Обновить' : 'Yangilash'}</button></div>
    {loading ? <div className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div> : error ? <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : items.length === 0 ? <div className="mt-6 rounded-2xl bg-white p-8 text-center"><p className="font-bold text-slate-800">{ru ? 'Бронирований пока нет' : 'Hozircha bronlar yo‘q'}</p><Link href="/listings" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">{ru ? 'Найти дачу' : 'Dacha topish'}</Link></div> : <div className="mt-6 grid gap-4 md:grid-cols-2">{items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {item.listing?.image ? <img src={item.listing.image} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-slate-100 text-slate-400">RoyalHouse</div>}
      <div className="p-5"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Бронь' : 'Bron'} № {item.bookingNumber}</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{ru ? (item.listing?.titleRu || item.listing?.title || 'Дача') : (item.listing?.title || 'Dacha')}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : item.paymentStatus === 'processing' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(item.status, item.paymentStatus)}</span></div>
      <p className="mt-3 text-sm text-slate-600">{date(item.checkIn, ru)} — {date(item.checkOut, ru)} · {item.guests} {ru ? 'гостей' : 'mehmon'}</p>
      <p className="mt-3 text-sm text-slate-500">{item.role === 'partner' ? (ru ? 'Клиент' : 'Mijoz') : (ru ? 'Предоплата' : 'Avans')}: <span className="font-bold text-slate-800">{item.role === 'partner' ? `${item.guest?.name || '—'} · ${item.guest?.phone || '—'}` : money(item.depositAmount, ru)}</span></p>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-xs text-slate-400">{ru ? 'Стоимость' : 'Jami narx'}</p><p className="text-lg font-black text-slate-900">{money(item.totalAmount, ru)}</p></div><Link href={`/account/bookings/${item.id}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">{ru ? 'Подробнее' : 'Tafsilotlar'}</Link></div>
      </div></article>)}</div>}
  </div></main>
}
