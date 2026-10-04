'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'

const labels = {
  mortgage: ['Ipoteka', 'Ипотека'],
  insurance: ['Sug‘urta', 'Страхование'],
  legal: ['Huquqiy tekshiruv', 'Юридическая проверка'],
  cadastral: ['Kadastr', 'Кадастр'],
  property_service: ['Uy xizmatlari', 'Услуги по дому'],
  property_valuation: ['Mulkni baholash', 'Оценка недвижимости'],
} as const

function ServiceRequestForm() {
  const params = useSearchParams()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const tx = (uz: string, rr: string) => ru ? rr : uz
  const initialType = params.get('type') && labels[params.get('type')!] ? params.get('type')! : 'mortgage'
  const listingId = params.get('listing_id') || ''
  const [type, setType] = useState(initialType)
  const [amount, setAmount] = useState('')
  const [down, setDown] = useState('')
  const [term, setTerm] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    const r = await fetch('/api/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_type: type, listing_id: listingId || null, requested_amount: amount || null, down_payment: down || null, term_months: term || null, contact_phone: phone, notes }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setMessage(tx('So‘rovingiz qabul qilindi. Keyingi aloqa Royalhouse orqali davom etadi.','Ваша заявка принята. Дальнейшая связь продолжится через Royalhouse.')); setAmount(''); setDown(''); setTerm(''); setNotes('') }
    else setMessage(d.error || tx('So‘rov yuborilmadi. Avval tizimga kirganingizni tekshiring.','Заявка не отправлена. Проверьте, что вы вошли в систему.'))
    setBusy(false)
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><div className="mx-auto max-w-2xl px-4 py-10"><Link href="/services" className="text-sm font-bold text-emerald-700">← {tx('Xizmatlarga qaytish','Вернуться к услугам')}</Link><div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-emerald-600">Royalhouse Services</p><h1 className="mt-2 text-3xl font-black">{tx('Xizmat bo‘yicha so‘rov','Заявка на услугу')}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{tx('So‘rov yuboring. Sug‘urta va boshqa hamkorlik xizmatlari hozircha funnel bosqichida; hamkor kompaniyalar bilan shartnoma va API ma’lumotlari ulangach, onlayn rasmiylashtirish shu oqimga ulanadi.','Отправьте заявку. Страхование и другие партнёрские услуги пока находятся на этапе воронки; после подключения договоров и API партнёров онлайн-оформление будет доступно в этом потоке.')}</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-bold">{tx('Xizmat turi','Тип услуги')}<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3">{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v[ru ? 1 : 0]}</option>)}</select></label>{type==='mortgage'&&<div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">{tx('Summa','Сумма')}<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="500 000 000" /></label><label className="text-sm font-bold">{tx('Boshlang‘ich to‘lov','Первоначальный взнос')}<input inputMode="decimal" value={down} onChange={e=>setDown(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="100 000 000" /></label><label className="text-sm font-bold">{tx('Muddat (oy)','Срок (мес.)')}<input inputMode="numeric" value={term} onChange={e=>setTerm(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="240" /></label></div>}{(type==='insurance'||type==='property_valuation')&&<div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{type==='insurance'?tx('Sug‘urta kompaniyasi tanlash, tariflarni olish va polisni onlayn rasmiylashtirish uchun keyingi bosqichda hamkor API ulanadi.','На следующем этапе будет подключён API партнёра для выбора страховой компании, получения тарифов и онлайн-оформления полиса.'):tx('Baholovchi hamkor tanlash va ko‘chmas mulk qiymatini aniqlash bo‘yicha so‘rov qabul qilinadi.','Принимается заявка на выбор партнёра-оценщика и определение стоимости недвижимости.')}</div>}<label className="block text-sm font-bold">{tx('Telefon','Телефон')}<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="+998 90 123 45 67" /></label><label className="block text-sm font-bold">{tx('Izoh','Комментарий')}<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder={tx("Qo‘shimcha ma’lumot...","Дополнительная информация...")} /></label>{message&&<div className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">{message}</div>}<button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy?tx('Yuborilmoqda...','Отправка...'):tx('So‘rov yuborish','Отправить заявку')}</button></form></div></div></main>
}

export default function ServiceRequestPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-sm font-semibold text-slate-500">{tx('Yuklanmoqda...','Загрузка...')}</div></main>}><ServiceRequestForm /></Suspense>
}
