'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const labels: Record<string, string> = { mortgage: 'Ipoteka', insurance: 'Sug‘urta', legal: 'Huquqiy tekshiruv', cadastral: 'Kadastr', property_service: 'Uy xizmatlari' }

function ServiceRequestForm() {
  const params = useSearchParams()
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
    if (r.ok) { setMessage('So‘rovingiz qabul qilindi. Keyingi aloqa Prohouse orqali davom etadi.'); setAmount(''); setDown(''); setTerm(''); setNotes('') }
    else setMessage(d.error || 'So‘rov yuborilmadi. Avval tizimga kirganingizni tekshiring.')
    setBusy(false)
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><div className="mx-auto max-w-2xl px-4 py-10"><Link href="/services" className="text-sm font-bold text-emerald-700">← Xizmatlarga qaytish</Link><div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-emerald-600">Prohouse Services</p><h1 className="mt-2 text-3xl font-black">Xizmat bo‘yicha so‘rov</h1><p className="mt-2 text-sm leading-6 text-slate-500">So‘rov yuboring. Bu forma hali bank, sug‘urta yoki davlat tizimiga avtomatik ariza bermaydi — hamkorlik funnelining boshlang‘ich qadamidir.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-bold">Xizmat turi<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3">{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{type==='mortgage'&&<div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">Summa<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="500 000 000" /></label><label className="text-sm font-bold">Boshlang‘ich to‘lov<input inputMode="decimal" value={down} onChange={e=>setDown(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="100 000 000" /></label><label className="text-sm font-bold">Muddat (oy)<input inputMode="numeric" value={term} onChange={e=>setTerm(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="240" /></label></div>}<label className="block text-sm font-bold">Telefon<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="+998 90 123 45 67" /></label><label className="block text-sm font-bold">Izoh<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="Qo‘shimcha ma’lumot..." /></label>{message&&<div className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">{message}</div>}<button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy?'Yuborilmoqda...':'So‘rov yuborish'}</button></form></div></div></main>
}

export default function ServiceRequestPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-sm font-semibold text-slate-500">Yuklanmoqda...</div></main>}><ServiceRequestForm /></Suspense>
}
