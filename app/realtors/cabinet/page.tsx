'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'

type Mode = 'login' | 'register'

export default function RealtorCabinetPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const tx = (uz: string, rr: string) => ru ? rr : uz
  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [certificate, setCertificate] = useState('')
  const [experience, setExperience] = useState('0')
  const [agencyName, setAgencyName] = useState('')
  const [serviceAreas, setServiceAreas] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/realtors/cabinet', { cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!active || !response.ok) return
        if (data.realtor) { router.replace('/realtors/cabinet/dashboard'); return }
        setHasSession(true)
        setMode('register')
        setSent(true)
        if (data.phone) setPhone(data.phone)
        setMessage(tx('Asosiy kabinet sessiyasi faol. Rieltor arizasini SMSsiz yuborishingiz mumkin.', 'Сессия основного кабинета активна. Заявку риелтора можно отправить без SMS.'))
      })
      .catch(() => {})
      .finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [router, ru])

  async function sendCode() {
    if (phone.replace(/\D/g, '').length < 12) return setMessage(tx('Telefon raqamini to‘liq kiriting.','Введите полный номер телефона.'))
    setLoading(true); setMessage('')
    try {
      const r = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || tx('SMS yuborilmadi','SMS не отправлено'))
      setSent(true); setMessage(d.testMode ? tx('Test rejimi: 321321 kodidan foydalaning.','Тестовый режим: используйте код 321321.') : tx('SMS kodi yuborildi.','Код из SMS отправлен.'))
    } catch (e) { setMessage(e instanceof Error ? e.message : tx('SMS yuborishda xatolik','Ошибка отправки SMS')) } finally { setLoading(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!hasSession && (!sent || code.length !== 6)) return setMessage(tx('SMS kodini kiriting.','Введите код из SMS.'))
    setLoading(true); setMessage('')
    try {
      if (!hasSession) {
        const authResponse = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
        const authData = await authResponse.json()
        if (!authResponse.ok) throw new Error(authData.error || tx('Kod noto‘g‘ri','Неверный код'))
      }
      const statusResponse = await fetch('/api/realtors/cabinet', { cache: 'no-store', credentials: 'same-origin' })
      const statusData = await statusResponse.json().catch(() => ({}))
      if (!statusResponse.ok) throw new Error(statusData.message || statusData.error || tx('Sessiya tekshirilmadi.','Не удалось проверить сессию.'))
      if (mode === 'login') {
        if (!statusData.realtor) throw new Error(tx('Rieltor kabineti topilmadi. Avval ro‘yxatdan o‘ting.','Кабинет риелтора не найден. Сначала зарегистрируйтесь.'))
        router.replace('/realtors/cabinet/dashboard')
        return
      }
      if (!name.trim() || !certificate.trim()) throw new Error(tx('F.I.O. va malaka sertifikati raqamini kiriting.','Введите Ф.И.О. и номер квалификационного сертификата.'))
      const applicationResponse = await fetch('/api/realtors/cabinet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ display_name: name.trim(), phone, certificate_number: certificate.trim(), experience_years: Number(experience) || 0, agency_name: agencyName.trim(), service_areas: serviceAreas.split(',').map(area => area.trim()).filter(Boolean).slice(0, 20) }),
      })
      const applicationData = await applicationResponse.json().catch(() => ({}))
      if (!applicationResponse.ok) {
        if (applicationResponse.status === 409 && applicationData.verificationStatus) { router.replace('/realtors/cabinet/dashboard'); return }
        throw new Error(applicationData.message || applicationData.error || tx('Arizani yuborib bo‘lmadi. Qayta urinib ko‘ring.','Не удалось отправить заявку. Попробуйте ещё раз.'))
      }
      router.replace('/realtors/cabinet/dashboard?submitted=1')
    } catch (e) { setMessage(e instanceof Error ? e.message : tx('Xatolik yuz berdi','Произошла ошибка')) } finally { setLoading(false) }
  }

  if (checkingSession) return <main className="min-h-screen bg-slate-50 p-10"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center">{tx('Sessiya tekshirilmoqda...','Проверка сессии...')}</div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><div className="mb-5 flex items-center justify-between"><Link href="/account" className="text-sm font-bold text-emerald-700">← {tx('Shaxsiy kabinet','Личный кабинет')}</Link><Link href="/" className="text-2xl font-black">Royal<span className="text-emerald-500">house</span></Link></div><section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-slate-900 px-6 py-8 text-white sm:px-8"><p className="text-xs font-black tracking-[.18em] text-emerald-400">PROFESSIONAL CABINET</p><h1 className="mt-2 text-3xl font-black">{tx('Rieltor kabineti','Кабинет риелтора')}</h1><p className="mt-2 text-sm text-slate-300">{tx('Rieltorlar uchun alohida kirish va verifikatsiya.','Отдельный вход и верификация для риелторов.')}</p></div><div className="p-6 sm:p-8">{!hasSession && <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setMode('login'); setSent(false); setMessage('') }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{tx('Kirish','Войти')}</button><button type="button" onClick={() => { setMode('register'); setSent(false); setMessage('') }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{tx('Ro‘yxatdan o‘tish','Регистрация')}</button></div>}<form onSubmit={verify} className="mt-6 space-y-5">{!hasSession && <div><label className="mb-2 block text-sm font-bold">{tx('Telefon raqami','Номер телефона')}</label><div className="flex gap-2"><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent ? tx('Qayta yuborish','Отправить повторно') : tx('SMS yuborish','Отправить SMS')}</button></div></div>}{!hasSession && sent && <div><label className="mb-2 block text-sm font-bold">{tx('SMS kodi','Код из SMS')}</label><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em]"/></div>}{(hasSession || (mode === 'register' && sent)) && <><div><label className="mb-2 block text-sm font-bold">{tx('F.I.O.','Ф.И.О.')}</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={tx('Ism Familiya Otasining ismi','Имя Фамилия Отчество')}/></div><div><label className="mb-2 block text-sm font-bold">{tx('Malaka sertifikati raqami','Номер квалификационного сертификата')}</label><input value={certificate} onChange={e => setCertificate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-bold">{tx('Tajriba (yil)','Опыт (лет)')}</label><input type="number" min="0" value={experience} onChange={e => setExperience(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-bold">{tx('Agentlik nomi (ixtiyoriy)','Название агентства (необязательно)')}</label><input value={agencyName} onChange={e => setAgencyName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={tx('Agentlik yoki kompaniya','Агентство или компания')}/></div><div><label className="mb-2 block text-sm font-bold">{tx('Xizmat hududlari','Районы работы')}</label><input value={serviceAreas} onChange={e => setServiceAreas(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={tx('Masalan: Chilonzor, Yunusobod, Sergeli','Например: Чиланзар, Юнусабад, Сергели')}/><p className="mt-1 text-xs text-slate-500">{tx('Hududlarni vergul bilan ajrating.','Разделяйте районы запятыми.')}</p></div></>}{message && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}{(hasSession || sent) && <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading ? tx('Tekshirilmoqda...','Проверка...') : mode === 'login' ? tx('Rieltor kabinetiga kirish','Войти в кабинет риелтора') : tx('Rieltor sifatida ariza yuborish','Подать заявку как риелтор')}</button>}</form></div></section></div></main>
}
