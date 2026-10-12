'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Booking = {
  id: string; bookingNumber: string; checkIn: string; checkOut: string; guests: number; currency: string; totalAmount: number; depositPercent: number; depositAmount: number
  paymentProvider: string; paymentStatus: string; status: string; createdAt: string; paidAt: string | null; providerPaymentId: string | null
  listing: { id: string; title: string; titleRu: string | null; image: string | null; city: string; district: string | null } | null
  guest: { name: string | null; phone: string | null } | null
  receipt: null | { bookingNumber: string; bookingId: string; amount: number; currency: string; paidAt: string; transactionId: string; status: string; provider: string }
}
const money = (value: number, ru: boolean) => `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(value)} ${ru ? 'сум' : 'so‘m'}`
const date = (value: string, ru: boolean) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tashkent' }).format(new Date(value + 'T12:00:00+05:00'))
const dateTime = (value: string, ru: boolean) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' }).format(new Date(value))

export default function RentalBookingDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [booking, setBooking] = useState<Booking | null>(null)
  const [role, setRole] = useState<'customer' | 'partner'>('customer')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const auth = createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) { router.replace(`/register?next=${encodeURIComponent(`/account/bookings/${params.id}`)}`); return }
    const response = await fetch(`/api/account/rental-bookings/${encodeURIComponent(params.id)}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) setError(response.status === 403 ? (ru ? 'У вас нет доступа к этой брони.' : 'Bu bronni ko‘rishga ruxsatingiz yo‘q.') : data.error || (ru ? 'Не удалось загрузить бронь.' : 'Bronni yuklab bo‘lmadi.'))
    else { setBooking(data.booking); setRole(data.role) }
    setLoading(false)
  }, [params.id, router, ru])
  useEffect(() => { void load() }, [load])

  const statusLabel = booking?.paymentStatus === 'paid' ? (ru ? 'Аванс оплачен' : 'Avans to‘langan') : booking?.paymentStatus === 'processing' ? (ru ? 'Проверяется' : 'Tekshirilmoqda') : booking?.status === 'cancelled' ? (ru ? 'Отменено' : 'Bekor qilingan') : (ru ? 'Ожидает оплаты' : 'To‘lov kutilmoqda')

  if (loading) return <main className="min-h-[60vh] bg-slate-50 p-8 text-center text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</main>
  if (error || !booking) return <main className="min-h-[60vh] bg-slate-50 px-4 py-10"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error || (ru ? 'Бронь не найдена.' : 'Bron topilmadi.')}<p className="mt-4"><Link className="font-bold text-emerald-700" href="/account/bookings">{ru ? 'К списку броней' : 'Bronlar ro‘yxatiga'}</Link></p></div></main>

  return <><style jsx global>{`@media print { body * { visibility: hidden !important; } #payment-receipt, #payment-receipt * { visibility: visible !important; } #payment-receipt { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0 !important; border: 0 !important; box-shadow: none !important; } .print\\:hidden { display: none !important; } }`}</style><main className="min-h-[65vh] bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-3xl">
    <Link href="/account/bookings" className="text-sm font-bold text-emerald-700">{ru ? '← Мои бронирования' : '← Mening bronlarim'}</Link>
    <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
      {booking.listing?.image && <img src={booking.listing.image} alt="" className="h-56 w-full object-cover" />}
      <div className="p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{ru ? 'Бронь' : 'Bron'} № {booking.bookingNumber}</p><h1 className="mt-1 text-2xl font-black text-slate-900">{ru ? (booking.listing?.titleRu || booking.listing?.title || 'Дача') : (booking.listing?.title || 'Dacha')}</h1><p className="mt-1 text-sm text-slate-500">{[booking.listing?.city, booking.listing?.district].filter(Boolean).join(', ')}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${booking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{statusLabel}</span></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label={ru ? 'Заезд' : 'Kirish'} value={date(booking.checkIn, ru)} /><Info label={ru ? 'Выезд' : 'Chiqish'} value={date(booking.checkOut, ru)} /><Info label={ru ? 'Гости' : 'Mehmonlar'} value={String(booking.guests)} /><Info label={ru ? 'Создано' : 'Yaratilgan vaqt'} value={dateTime(booking.createdAt, ru)} /></div>
      {role === 'partner' && booking.guest && <div className="mt-5 rounded-2xl border border-slate-200 p-4"><h2 className="font-extrabold">{ru ? 'Данные клиента' : 'Mijoz ma’lumotlari'}</h2><p className="mt-2 text-sm text-slate-600">{ru ? 'Ф.И.О.' : 'F.I.O.'}: <b>{booking.guest.name || '—'}</b></p><p className="mt-1 text-sm text-slate-600">{ru ? 'Телефон' : 'Telefon'}: <b>{booking.guest.phone || '—'}</b></p></div>}
      <div className="mt-6 rounded-2xl bg-slate-50 p-4"><h2 className="font-extrabold">{ru ? 'Оплата' : 'To‘lov'}</h2><MoneyRow label={ru ? 'Полная стоимость' : 'Umumiy narx'} value={money(booking.totalAmount, ru)} /><MoneyRow label={ru ? `Предоплата (${booking.depositPercent}%)` : `Avans (${booking.depositPercent}%)`} value={money(booking.depositAmount, ru)} /><MoneyRow label={ru ? 'Остаток при заезде' : 'Kirishda qolgan summa'} value={money(Math.max(0, booking.totalAmount - booking.depositAmount), ru)} /></div>
      {booking.receipt ? <section id="payment-receipt" className="receipt-print mt-6 rounded-2xl border-2 border-emerald-200 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{ru ? 'Подтверждение оплаты' : 'To‘lov tasdig‘i'}</p><h2 className="mt-1 text-xl font-black">{ru ? 'Квитанция Payme' : 'Payme to‘lov cheki'}</h2></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{ru ? 'Оплачено' : 'To‘langan'}</span></div><div className="mt-5 space-y-3"><MoneyRow label={ru ? 'Номер брони' : 'Bron raqami'} value={booking.receipt.bookingNumber} /><MoneyRow label={ru ? 'Сумма платежа' : 'To‘lov summasi'} value={money(booking.receipt.amount, ru)} /><MoneyRow label={ru ? 'Дата и время' : 'Sana va vaqt'} value={dateTime(booking.receipt.paidAt, ru)} /><MoneyRow label={ru ? 'ID транзакции Payme' : 'Payme tranzaksiya ID'} value={booking.receipt.transactionId} /><MoneyRow label={ru ? 'Статус платежа' : 'To‘lov holati'} value={ru ? 'Успешно оплачен' : 'Muvaffaqiyatli to‘langan'} /></div><p className="mt-5 border-t border-dashed border-emerald-200 pt-4 text-xs text-slate-500">{ru ? 'Квитанция сформирована на основании подтверждённой транзакции Payme.' : 'Chek Payme serveri tasdiqlagan haqiqiy tranzaksiya asosida shakllantirildi.'}</p><button onClick={() => window.print()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white print:hidden">{ru ? 'Распечатать / Сохранить PDF' : 'Chop etish / PDF saqlash'}</button></section> : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">{ru ? 'Квитанция пока недоступна' : 'Chek hozircha mavjud emas'}</p><p className="mt-1 text-sm text-amber-800">{booking.paymentStatus === 'processing' ? (ru ? 'Payme обрабатывает платёж. Квитанция появится после подтверждения.' : 'Payme to‘lovni tekshirmoqda. Tasdiqlangach chek paydo bo‘ladi.') : (ru ? 'Квитанция появится только после успешного подтверждения оплаты Payme.' : 'Chek faqat Payme to‘lovni muvaffaqiyatli tasdiqlagandan keyin paydo bo‘ladi.')}</p></div>}
      </div>
    </section>
  </div></main></>
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div> }
function MoneyRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0"><span className="text-sm text-slate-500">{label}</span><span className="break-all text-right text-sm font-extrabold text-slate-900">{value}</span></div> }
