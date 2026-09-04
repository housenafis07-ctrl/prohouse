'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type AccountType = 'individual' | 'partner'
type PartnerType = 'self_employed' | 'sole_proprietor' | 'llc'

const emptyForm = { fullName:'', companyName:'', inn:'', bankName:'', bankAccount:'', mfo:'', directorFullName:'' }

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>('individual')
  const [partnerType, setPartnerType] = useState<PartnerType>('self_employed')
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [existingProfile, setExistingProfile] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))

  useEffect(() => {
    const loadExisting = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (data) {
        setExistingProfile(true)
        setPhone(data.phone || user.phone || '+998 ')
        setAccountType(data.account_type || 'individual')
        if (data.partner_type) setPartnerType(data.partner_type)
        setForm({ fullName:data.full_name || data.fullName || '', companyName:data.company_name || data.companyName || '', inn:data.inn || '', bankName:data.bank_name || data.bankName || '', bankAccount:data.bank_account || data.bankAccount || '', mfo:data.mfo || '', directorFullName:data.director_full_name || data.directorFullName || '' })
      }
    }
    loadExisting()
  }, [])

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
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (userId && !existingProfile) {
        await supabase.from('profiles').upsert({ id:userId, phone, account_type:accountType, partner_type:accountType === 'partner' ? partnerType : null, full_name:form.fullName, company_name:form.companyName || null, inn:form.inn || null, bank_name:form.bankName || null, bank_account:form.bankAccount || null, mfo:form.mfo || null, director_full_name:form.directorFullName || null })
      }
      setExistingProfile(true)
      setMessage('Kirish muvaffaqiyatli. Profil ma’lumotlari saqlandi.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Kirishda xatolik') }
    finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link><div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h1 className="text-3xl font-extrabold text-slate-900">{existingProfile ? 'Prohouse’ga kirish' : 'Ro‘yxatdan o‘tish'}</h1><p className="mt-2 text-slate-500">Telefon raqamingiz orqali davom eting.</p>

    {!existingProfile && <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setAccountType('individual')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Jismoniy shaxs</button><button type="button" onClick={() => setAccountType('partner')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType === 'partner' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Hamkor</button></div>}

    <form onSubmit={submit} className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-semibold">Telefon raqami</label><div className="flex gap-2"><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent ? 'Qayta yuborish' : 'SMS yuborish'}</button></div></div>
    {sent && <div><label className="mb-2 block text-sm font-semibold">SMS kodi</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em]"/></div>}

    {!existingProfile && (accountType === 'individual' ? <div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Ism Familiya Otasining ismi"/></div> : <><div><label className="mb-2 block text-sm font-semibold">Hamkor turi</label><select value={partnerType} onChange={e=>setPartnerType(e.target.value as PartnerType)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="self_employed">O‘zini o‘zi band qilgan — O‘BQ</option><option value="sole_proprietor">Yakka tartibdagi tadbirkor — YaTT</option><option value="llc">Mas’uliyati cheklangan jamiyat — MChJ</option></select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">INN</label><input value={form.inn} onChange={e=>update('inn',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></div>{partnerType === 'llc' && <div><label className="mb-2 block text-sm font-semibold">Tashkilot nomi</label><input value={form.companyName} onChange={e=>update('companyName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div>}<div><label className="mb-2 block text-sm font-semibold">Rahbar F.I.O.</label><input value={form.directorFullName} onChange={e=>update('directorFullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">Bank rekvizitlari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.bankName} onChange={e=>update('bankName',e.target.value)} required placeholder="Bank nomi" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.mfo} onChange={e=>update('mfo',e.target.value)} required placeholder="MFO" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.bankAccount} onChange={e=>update('bankAccount',e.target.value)} required placeholder="Hisob raqami" className="rounded-xl border border-slate-200 px-4 py-3"/></div></div></>)}
    {existingProfile && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Profilingiz avval ro‘yxatdan o‘tgan. Qo‘shimcha ma’lumotlarni qayta to‘ldirish shart emas.</div>}
    {message && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}<button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading ? 'Yuklanmoqda...' : existingProfile ? 'Kirish' : 'Ro‘yxatdan o‘tish'}</button></form></div></div></main>
}
