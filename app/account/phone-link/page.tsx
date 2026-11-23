'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Profile = { phone: string | null; full_name: string | null }

export default function PhoneLinkPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [profile, setProfile] = useState<Profile | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data } = await supabase.from('profiles').select('phone,full_name').eq('id', user.id).maybeSingle()
      if (!data) { router.replace('/register'); return }
      setProfile(data)
      setPhone(data.phone || '')
    }
    load()
  }, [router])

  async function sendCode() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/account/phone-link/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось отправить SMS.' : 'SMS yuborib bo‘lmadi.'))
      setStep('code')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? 'Ошибка SMS.' : 'SMS xatosi.'))
    } finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/account/phone-link/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось подтвердить номер.' : 'Telefon raqamini tasdiqlab bo‘lmadi.'))
      if (data.session) await createClient().auth.setSession(data.session)
      router.replace('/account')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? 'Ошибка подтверждения.' : 'Tasdiqlash xatosi.'))
    } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-xl"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← {ru ? 'В кабинет' : 'Kabinetga qaytish'}</Link><section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h1 className="text-2xl font-black text-slate-900">{ru ? 'Подтверждение телефона' : 'Telefon raqamini tasdiqlash'}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{ru ? 'Добавьте номер телефона к вашему Telegram-профилю. После SMS-подтверждения он будет связан с этим аккаунтом.' : 'Telegram orqali kirilgan profilingizga telefon raqamini qo‘shing. SMS tasdiqlangach, raqam shu akkauntga bog‘lanadi.'}</p>{profile?.full_name && <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">{profile.full_name}</p>}<label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Номер телефона' : 'Telefon raqami'}</label><input inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={step === 'code' || busy} placeholder="+998 90 123 45 67" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-emerald-500 disabled:bg-slate-50"/>{step === 'phone' ? <button type="button" onClick={sendCode} disabled={busy} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy ? (ru ? 'Отправка...' : 'Yuborilmoqda...') : (ru ? 'Получить SMS-код' : 'SMS kodini olish')}</button> : <><label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Код из SMS' : 'SMS kodi'}</label><input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-emerald-500"/><button type="button" onClick={verify} disabled={busy || code.length !== 6} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy ? (ru ? 'Проверка...' : 'Tekshirilmoqda...') : (ru ? 'Подтвердить номер' : 'Raqamni tasdiqlash')}</button><button type="button" onClick={() => { setStep('phone'); setCode(''); setMessage('') }} className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-700">{ru ? 'Изменить номер' : 'Raqamni o‘zgartirish'}</button></>}{message && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p>}<p className="mt-5 text-xs leading-5 text-slate-400">{ru ? 'Если номер уже используется другим аккаунтом, система безопасно объединит Telegram-профиль только если это Telegram-only профиль. Реальный телефонный аккаунт не будет перезаписан.' : 'Agar raqam boshqa akkauntda mavjud bo‘lsa, tizim faqat Telegram-only profilni mavjud profil bilan xavfsiz birlashtiradi. Haqiqiy telefonli profil ustidan yozilmaydi.'}</p></section></div></main>
}
