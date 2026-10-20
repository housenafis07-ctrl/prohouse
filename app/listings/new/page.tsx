'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'
import AppIcon from '@/app/components/AppIcon'
import { createClient } from '@/utils/supabase/client'

export default function NewListingPage() {
  const { tx } = useI18n()
  const [loading, setLoading] = useState(true)
  const [savingPhone, setSavingPhone] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [phone, setPhone] = useState('+998 ')
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [phoneSent, setPhoneSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) {
          setError(tx('Avval Telegram yoki telefon orqali tizimga kiring.','Сначала войдите через Telegram или по номеру телефона.'))
          setLoading(false)
        }
        return
      }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profileError || !profile) {
        setError(tx('Profil ma’lumotlarini olishda xatolik.','Не удалось получить данные профиля.'))
      } else {
        setFullName(profile.full_name || '')
        const currentPhone = profile.phone || ''
        if (currentPhone) {
          setPhone(currentPhone)
          setPhoneSaved(true)
        }
      }
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [tx])

  async function sendPhoneCode() {
    setSavingPhone(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || tx('SMS yuborilmadi.','SMS не отправлено.'))
      setPhoneSent(true)
      setMessage(tx('SMS kodi yuborildi.','SMS-код отправлен.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Xatolik yuz berdi.','Произошла ошибка.'))
    } finally {
      setSavingPhone(false)
    }
  }

  async function verifyPhone() {
    setVerifyingPhone(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || tx('Telefon raqamini tasdiqlab bo‘lmadi.','Не удалось подтвердить номер телефона.'))

      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (sessionError) throw sessionError

      setPhone(data.phone || phone)
      setPhoneSaved(true)
      setPhoneSent(false)
      setCode('')
      setMessage(tx('Telefon raqami tasdiqlandi. Endi e’lon joylashtirishingiz mumkin.','Номер телефона подтверждён. Теперь можно разместить объявление.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('Xatolik yuz berdi.','Произошла ошибка.'))
    } finally {
      setVerifyingPhone(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" /><p className="mt-4 text-sm font-semibold text-slate-600">{tx('Profil tekshirilmoqda...','Проверяем профиль...')}</p></div></main>

  if (!phoneSaved) return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-emerald-700">← Royalhouse</Link><div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="user" className="h-7 w-7" /></div><h1 className="mt-5 text-2xl font-extrabold text-slate-950">{tx('E’lon joylashtirishdan oldin','Перед размещением объявления')}</h1><p className="mt-2 text-slate-500">{tx('Bog‘lanish uchun telefon raqamingizni bir marta tasdiqlang. Keyingi e’lonlarda qayta so‘ralmaydi.','Один раз подтвердите номер телефона для связи. В следующих объявлениях он повторно запрашиваться не будет.')}</p>{fullName&&<div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-500">{tx('E’lon joylovchi','Автор объявления')}</p><p className="mt-1 font-bold text-slate-900">{fullName}</p></div>}<label className="mt-5 block text-sm font-bold text-slate-800">{tx('Telefon raqami','Номер телефона')}</label><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" disabled={phoneSent} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-lg outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50" placeholder="+998 90 123 45 67" />{phoneSent&&<><label className="mt-4 block text-sm font-bold text-slate-800">{tx('SMS kodi','SMS-код')}</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} type="text" inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-lg tracking-[0.35em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="000000" />{message&&<div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}<button type="button" onClick={verifyPhone} disabled={verifyingPhone||code.length!==6} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">{verifyingPhone?tx('Tekshirilmoqda...','Проверяем...'):tx('Tasdiqlash va davom etish →','Подтвердить и продолжить →')}</button><button type="button" onClick={()=>{setPhoneSent(false);setCode('');setMessage('');setError('')}} className="mt-3 w-full text-sm font-semibold text-slate-500">{tx('Raqamni o‘zgartirish','Изменить номер')}</button></>}{error&&<div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}{!phoneSent&&<><button type="button" onClick={sendPhoneCode} disabled={savingPhone} className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">{savingPhone?tx('SMS yuborilmoqda...','Отправляем SMS...'):tx('SMS yuborish','Отправить SMS')}</button><p className="mt-3 text-center text-xs text-slate-400">{tx('Telefon raqami faqat e’lon joylashtirish va xaridor/ijarachi bilan bog‘lanish uchun ishlatiladi.','Номер используется для размещения объявления и связи с покупателем или арендатором.')}</p></>}</div></div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-4xl">
    <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">ROYALHOUSE</p><h1 className="mt-1 text-3xl font-bold text-slate-950">{tx('E’lon joylashtirish','Разместить объявление')}</h1><p className="mt-2 text-sm text-slate-500">{tx('E’lon turini tanlang','Выберите тип объявления')}</p></div><Link href="/account" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{tx('Shaxsiy kabinet','Личный кабинет')}</Link></div>
    <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><strong>{fullName || tx('Royalhouse foydalanuvchisi','Пользователь Royalhouse')}</strong> · {phone}</div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Link href="/listings/new/property" className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-950 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="building" className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">{tx('Ko‘chmas mulk','Недвижимость')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{tx('Sotish, sotib olish, ijara va yangi uylar','Продажа, покупка, аренда и новостройки')}</p><span className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{tx('E’lon joylashtirish →','Разместить объявление →')}</span></Link>
      <Link href="/listings/new/service" className="group rounded-3xl border border-emerald-500 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><AppIcon name="tools" className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">{tx('Xizmatlar','Услуги')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{tx('Professional xizmatlaringizni mijozlarga taklif qiling','Размещение профессиональных услуг для клиентов')}</p><span className="mt-5 inline-flex rounded-xl border border-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-700">{tx('Xizmat e’lonini joylashtirish →','Разместить объявление услуги →')}</span></Link>
    </div>
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{tx('Xizmatlar uchun alohida forma ishlatiladi: xizmat turi → ma’lumotlar → hudud → narx → rasmlar → tekshirish.','Для услуг используется отдельная форма: услуга → данные → регион → цена → фото → проверка.')}</div>
  </div></main>
}
