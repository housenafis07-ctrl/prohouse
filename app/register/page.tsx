'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type AccountType = 'individual' | 'partner'
type PartnerType = 'self_employed' | 'sole_proprietor' | 'llc'

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>('individual')
  const [partnerType, setPartnerType] = useState<PartnerType>('self_employed')
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ fullName:'', companyName:'', inn:'', bankName:'', bankAccount:'', mfo:'', oked:'', directorFullName:'' })

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 12) return setMessage('Telefon raqamini to‘liq kiriting.')
    setLoading(true); setMessage('')
    try {
      const response = await fetch('/api/auth/send-code', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'SMS yuborilmadi')
      setSent(true); setMessage('SMS kodi yuborildi.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'SMS yuborishda xatolik') }
    finally { setLoading(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!sent || code.length < 4) return setMessage('Avval SMS kodini tasdiqlang.')
    setLoading(true); setMessage('')
    try {
      const response = await fetch('/api/auth/verify-code', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone, code }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kod noto‘g‘ri')
      const supabase = createClient()
      const { data: authData, error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
      if (authData) {
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData.session?.user?.id
        if (userId) {
          await supabase.from('profiles').upsert({ id:userId, phone, account_type:accountType, partner_type:accountType === 'partner' ? partnerType : null, ...form })
        }
      }
      setMessage('Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Ro‘yxatdan o‘tishda xatolik') }
    finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link>
      <div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Ro‘yxatdan o‘tish</h1>
        <p className="mt-2 text-slate-500">Telefon raqamingiz orqali Prohouse akkauntini yarating.</p>

        <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setAccountType('individual')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Jismoniy shaxs</button>
          <button type="button" onClick={() => setAccountType('partner')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType === 'partner' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Hamkor</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div><label className="mb-2 block text-sm font-semibold">Telefon raqami</label><div className="flex gap-2"><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+998 90 123 45 67" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent ? 'Qayta yuborish' : 'SMS yuborish'}</button></div></div>
          {sent && <div><label className="mb-2 block text-sm font-semibold">SMS kodi</label><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="123456" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em] outline-none focus:border-emerald-500"/></div>}

          {accountType === 'individual' ? <div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Ism Familiya Otasining ismi"/></div> : <>
            <div><label className="mb-2 block text-sm font-semibold">Hamkor turi</label><select value={partnerType} onChange={e=>setPartnerType(e.target.value as PartnerType)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="self_employed">O‘zini o‘zi band qilgan — O‘BQ</option><option value="sole_proprietor">Yakka tartibdagi tadbirkor — YaTT</option><option value="llc">Mas’uliyati cheklangan jamiyat — MChJ</option></select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">INN</label><input value={form.inn} onChange={e=>update('inn',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></div>
            {partnerType === 'llc' && <div><label className="mb-2 block text-sm font-semibold">Tashkilot nomi</label><input value={form.companyName} onChange={e=>update('companyName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="MChJ nomi"/></div>}
            <div><label className="mb-2 block text-sm font-semibold">Rahbar F.I.O.</label><input value={form.directorFullName} onChange={e=>update('directorFullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div>
            <div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold text-slate-900">Bank rekvizitlari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.bankName} onChange={e=>update('bankName',e.target.value)} required placeholder="Bank nomi" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.mfo} onChange={e=>update('mfo',e.target.value)} required placeholder="MFO" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.bankAccount} onChange={e=>update('bankAccount',e.target.value)} required placeholder="Hisob raqami" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.oked} onChange={e=>update('oked',e.target.value)} placeholder="OKED" className="rounded-xl border border-slate-200 px-4 py-3"/></div></div>
          </>}
          {message && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading ? 'Yuklanmoqda...' : 'Ro‘yxatdan o‘tish'}</button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-400">Hamkor rekvizitlari biznes turi bo‘yicha saqlanadi. SMS tasdiqlash xizmati rekviz.uz API orqali ulanadi.</p>
      </div>
    </div>
  </main>
}
