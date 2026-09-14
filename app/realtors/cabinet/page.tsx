'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Mode = 'login' | 'register'

export default function RealtorCabinetPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [certificate, setCertificate] = useState('')
  const [experience, setExperience] = useState('0')

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 12) return setMessage('Telefon raqamini to‘liq kiriting.')
    setLoading(true); setMessage('')
    try {
      const r = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'SMS yuborilmadi')
      setSent(true); setMessage(d.testMode ? 'Test rejimi: 321321 kodidan foydalaning.' : 'SMS kodi yuborildi.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'SMS yuborishda xatolik') } finally { setLoading(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sent || code.length < 4) return setMessage('SMS kodini kiriting.')
    setLoading(true); setMessage('')
    try {
      const r = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Kod noto‘g‘ri')
      const supabase = createClient()
      if (!d.session?.access_token || !d.session?.refresh_token) throw new Error('Sessiya ma’lumotlari qaytmadi.')
      const sessionError = (await supabase.auth.setSession({ access_token: d.session.access_token, refresh_token: d.session.refresh_token })).error
      if (sessionError) throw sessionError
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sessiya topilmadi.')
      const { data: realtor } = await supabase.from('realtor_profiles').select('id,verification_status').eq('user_id', userData.user.id).maybeSingle()
      if (mode === 'login') {
        if (!realtor) throw new Error('Rieltor kabineti topilmadi. Avval rieltor sifatida ro‘yxatdan o‘ting.')
        router.replace('/realtors/cabinet/dashboard')
        return
      }
      if (realtor) { router.replace('/realtors/cabinet/dashboard'); return }
      if (!name.trim() || !certificate.trim()) throw new Error('F.I.O. va malaka sertifikati raqamini kiriting.')
      const { error } = await supabase.from('realtor_profiles').insert({ user_id: userData.user.id, display_name: name.trim(), phone, experience_years: Number(experience) || 0, verification_status: 'pending', rating: 0, reviews_count: 0, agency_id: null, bio: 'Prohouse rieltorlik kabineti orqali yuborilgan ariza.' })
      if (error) throw error
      router.replace('/realtors/cabinet/dashboard?submitted=1')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Xatolik yuz berdi') } finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><div className="mb-5 flex items-center justify-between"><Link href="/realtors" className="text-sm font-bold text-emerald-700">← Rieltorlar</Link><Link href="/" className="text-2xl font-black">Pro<span className="text-emerald-500">house</span></Link></div><section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-slate-900 px-6 py-8 text-white sm:px-8"><p className="text-xs font-black tracking-[.18em] text-emerald-400">PROFESSIONAL CABINET</p><h1 className="mt-2 text-3xl font-black">Rieltor kabineti</h1><p className="mt-2 text-sm text-slate-300">Rieltorlar uchun alohida kirish va verifikatsiya.</p></div><div className="p-6 sm:p-8"><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setMode('login'); setSent(false); setMessage('') }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Kirish</button><button type="button" onClick={() => { setMode('register'); setSent(false); setMessage('') }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Ro‘yxatdan o‘tish</button></div><form onSubmit={verify} className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-bold">Telefon raqami</label><div className="flex gap-2"><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent ? 'Qayta yuborish' : 'SMS yuborish'}</button></div></div>{sent && <div><label className="mb-2 block text-sm font-bold">SMS kodi</label><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em]"/></div>}{mode === 'register' && sent && <><div><label className="mb-2 block text-sm font-bold">F.I.O.</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Ism Familiya Otasining ismi"/></div><div><label className="mb-2 block text-sm font-bold">Malaka sertifikati raqami</label><input value={certificate} onChange={e => setCertificate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-bold">Tajriba (yil)</label><input type="number" min="0" value={experience} onChange={e => setExperience(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></>}{message && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}{sent && <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading ? 'Tekshirilmoqda...' : mode === 'login' ? 'Rieltor kabinetiga kirish' : 'Rieltor sifatida ariza yuborish'}</button>}</form></div></section></div></main>
}
