'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'
import AppIcon from '@/app/components/AppIcon'

type Profile = {
  phone: string | null
  full_name: string | null
  account_type: 'individual' | 'partner' | null
  partner_type: string | null
  company_name: string | null
  inn: string | null
  bank_name: string | null
  bank_account: string | null
  mfo: string | null
  oked: string | null
  director_full_name: string | null
}

const partnerLabels: Record<string, { uz: string; ru: string }> = {
  self_employed: { uz: 'O‘zini o‘zi band qilgan — O‘BQ', ru: 'Самозанятый' },
  sole_proprietor: { uz: 'Yakka tartibdagi tadbirkor — YaTT', ru: 'Индивидуальный предприниматель — ИП' },
  llc: { uz: 'Mas’uliyati cheklangan jamiyat — MChJ', ru: 'Общество с ограниченной ответственностью — ООО' },
}

type FieldProps = { label: string; value: string | null; form: Profile; field: keyof Profile; editing: boolean; required?: boolean; disabled?: boolean; onChange: (field: keyof Profile, value: string) => void }

function ProfileField({ label, value, form, field, editing, required = false, disabled = false, onChange }: FieldProps) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>{editing && !disabled ? <input value={String(form[field] ?? '')} onChange={e => onChange(field, e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-500" /> : <p className="mt-2 font-bold text-slate-900">{value || '—'}</p>}</div>
}

function StatusIcon({ type }: { type: 'check' | 'user' | 'home' | 'plus' | 'help' }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><AppIcon name={type} className="h-5 w-5" /></span>
}

export default function AccountPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [completion, setCompletion] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [telegramLinkUrl, setTelegramLinkUrl] = useState('')
  const [telegramBusy, setTelegramBusy] = useState(false)
  const [telegramError, setTelegramError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const { data, error: profileError } = await supabase.from('profiles').select('phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profileError) {
        setError(lang === 'ru' ? 'Не удалось проверить профиль. Обновите страницу и попробуйте снова.' : 'Profilni tekshirib bo‘lmadi. Sahifani yangilab qayta urinib ko‘ring.')
        setLoading(false)
        return
      }
      // A Supabase Auth session alone is not a completed Royalhouse registration.
      // Never render the personal cabinet until the matching public profile exists.
      if (!data) {
        router.replace('/register?next=%2Faccount')
        return
      }
      setProfile(data)
      setForm(data)
      const { data: completeness, error: completenessError } = await supabase.rpc('get_seller_profile_completeness')
      if (mounted) {
        if (completenessError) setError(prev => prev || completenessError.message)
        if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent)
        setLoading(false)
      }
    }
    load(); return () => { mounted = false }
  }, [router])

  useEffect(() => {
    let active = true
    fetch('/api/account/telegram/link', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (active && response.ok) {
          setTelegramLinked(Boolean(data.linked))
          setTelegramUsername(data.username || null)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function refreshTelegramStatus() {
    try {
      const response = await fetch('/api/account/telegram/link', { cache: 'no-store' })
      const data = await response.json()
      if (response.ok) {
        setTelegramLinked(Boolean(data.linked))
        setTelegramUsername(data.username || null)
        if (data.linked) setTelegramLinkUrl('')
      }
    } catch {}
  }

  async function createTelegramLink() {
    setTelegramBusy(true)
    setTelegramError('')
    try {
      const response = await fetch('/api/account/telegram/link', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || (lang === 'ru' ? 'Не удалось создать ссылку.' : 'Ulash havolasini yaratib bo‘lmadi.'))
      setTelegramLinkUrl(data.url)
    } catch (e) {
      setTelegramError(e instanceof Error ? e.message : (lang === 'ru' ? 'Ошибка Telegram.' : 'Telegram xatosi.'))
    } finally {
      setTelegramBusy(false)
    }
  }

  const setField = (key: keyof Profile, value: string) => setForm(v => v ? { ...v, [key]: value } : v)

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); if (!form) return
    if (!form.full_name?.trim()) { setError(lang === 'ru' ? 'Введите Ф.И.О.' : 'F.I.O. ni kiriting.'); return }
    if (form.account_type === 'partner' && !form.inn?.trim()) { setError(lang === 'ru' ? 'Введите ИНН.' : 'INN ni kiriting.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const response = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: form.full_name.trim(), account_type: form.account_type || 'individual', partner_type: form.partner_type, company_name: form.company_name?.trim() || '', inn: form.inn?.trim() || '', bank_name: form.bank_name?.trim() || '', bank_account: form.bank_account?.trim() || '', mfo: form.mfo?.trim() || '', oked: form.oked?.trim() || '', director_full_name: form.director_full_name?.trim() || '' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || (ru ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik'))
      const data = result.profile as Profile
      setProfile(data); setForm(data)
      const { data: completeness, error: completenessError } = await supabase.rpc('get_seller_profile_completeness')
      if (completenessError) throw completenessError
      if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent)
      setEditing(false); setSuccess(lang === 'ru' ? 'Данные профиля сохранены.' : 'Profil ma’lumotlari saqlandi.')
    } catch (e) { setError(e instanceof Error ? e.message : (lang === 'ru' ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik')) } finally { setSaving(false) }
  }

  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/'); router.refresh() }

  if (loading) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center shadow-sm">{lang === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}</div></main>
  if (!profile || !form) return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-extrabold text-slate-900">{lang === 'ru' ? 'Профиль не загружен' : 'Profil yuklanmadi'}</h1><p className="mt-3 text-sm text-slate-600">{error || (lang === 'ru' ? 'Обновите страницу и попробуйте снова.' : 'Sahifani yangilab qayta urinib ko‘ring.')}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</button><Link href="/" className="mt-4 block text-sm font-bold text-emerald-700">{lang === 'ru' ? 'На главную' : 'Bosh sahifaga qaytish'}</Link></div></main>

  const ru = lang === 'ru'
  const isPartner = profile.account_type === 'partner'
  const showPartnerFields = editing ? form.account_type === 'partner' : isPartner
  const display = editing ? form : profile
  const hasName = Boolean(profile.full_name?.trim())
  const actions = [
    { icon: 'plus' as const, title: ru ? 'Разместить объявление' : 'E’lon joylashtirish', text: ru ? 'Продайте или сдайте недвижимость через Royalhouse.' : 'Mulkingizni Royalhouse’da soting yoki ijaraga bering.', href: '/listings/new', primary: true },
    { icon: 'home' as const, title: ru ? 'Мои объявления' : 'Mening e’lonlarim', text: ru ? 'Просматривайте, редактируйте и управляйте своими объявлениями.' : 'Joylashtirgan e’lonlaringizni ko‘ring, tahrirlang va holatini boshqaring.', href: '/account/listings', primary: false },
    { icon: 'check' as const, title: ru ? 'Мои бронирования' : 'Mening bronlarim', text: ru ? 'Брони дач, статусы аванса и подтверждения оплаты.' : 'Dacha bronlari, avans holati va to‘lov tasdiqlari.', href: '/account/bookings', primary: false },
  ]

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between gap-4"><Link href="/" className="text-sm font-extrabold text-emerald-700">← Royalhouse</Link><button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{ru ? 'Выйти' : 'Chiqish'}</button></header>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.55fr_.8fr]"><section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-slate-900 px-6 py-7 text-white sm:px-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-300">{ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{profile.full_name || (ru ? 'Пользователь Royalhouse' : 'Royalhouse foydalanuvchisi')}</h1><p className="mt-2 text-sm text-slate-300">{profile.phone || (ru ? 'Номер телефона не указан' : 'Telefon raqami ko‘rsatilmagan')}</p></div><div className="rounded-2xl bg-white/10 px-3 py-2 text-center"><div className="text-xl font-black">{completion}%</div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-300">{ru ? 'профиль' : 'profil'}</div></div></div></div>
      <div className="p-6 sm:p-8" id="profile"><div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-lg font-extrabold text-slate-900">{ru ? 'Личные данные' : 'Shaxsiy ma’lumotlar'}</h2><p className="mt-1 text-sm text-slate-500">{ru ? 'Основные данные, связанные с вашим аккаунтом.' : 'Akkauntingizga tegishli asosiy ma’lumotlar.'}</p></div>{!editing && <button onClick={() => { setForm(profile); setEditing(true); setError(''); setSuccess('') }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">{ru ? 'Редактировать' : 'Tahrirlash'}</button>}</div>
      <form onSubmit={saveProfile}>{editing && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ru ? 'Подтверждённый номер телефона привязан к аккаунту и не изменяется здесь.' : 'Telefon raqami tasdiqlangan akkauntga bog‘langan va bu yerda o‘zgartirilmaydi.'}</div>}<div className="grid gap-4 sm:grid-cols-2"><ProfileField label="F.I.O." value={display.full_name} form={form} field="full_name" editing={editing} required onChange={setField}/><ProfileField label={ru ? 'Номер телефона' : 'Telefon raqami'} value={display.phone} form={form} field="phone" editing={editing} disabled onChange={setField}/><div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{ru ? 'Тип аккаунта' : 'Akkaunt turi'}</label>{editing ? <select value={form.account_type || 'individual'} onChange={e => setField('account_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900"><option value="individual">{ru ? 'Физическое лицо' : 'Jismoniy shaxs'}</option><option value="partner">{ru ? 'Партнёр' : 'Hamkor'}</option></select> : <p className="mt-2 font-bold text-slate-900">{isPartner ? (ru ? 'Партнёр' : 'Hamkor') : (ru ? 'Физическое лицо' : 'Jismoniy shaxs')}</p>}</div>{showPartnerFields && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{ru ? 'Организационно-правовая форма' : 'Hamkorning huquqiy shakli'}</label>{editing ? <select value={form.partner_type || 'self_employed'} onChange={e => setField('partner_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold"><option value="self_employed">{partnerLabels.self_employed[lang]}</option><option value="sole_proprietor">{partnerLabels.sole_proprietor[lang]}</option><option value="llc">{partnerLabels.llc[lang]}</option></select> : <p className="mt-2 font-bold text-slate-900">{partnerLabels[profile.partner_type || '']?.[lang] || '—'}</p>}</div>}{showPartnerFields && <ProfileField label="INN" value={display.inn} form={form} field="inn" editing={editing} required onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Организация' : 'Tashkilot'} value={display.company_name} form={form} field="company_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Ф.И.О. руководителя' : 'Rahbar F.I.O.'} value={display.director_full_name} form={form} field="director_full_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Название банка' : 'Bank nomi'} value={display.bank_name} form={form} field="bank_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Расчётный счёт' : 'Hisob raqami'} value={display.bank_account} form={form} field="bank_account" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="МФО" value={display.mfo} form={form} field="mfo" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="ОКЭД" value={display.oked} form={form} field="oked" editing={editing} onChange={setField}/>}</div>{error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}{success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}{editing && <div className="mt-6 flex gap-3"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError(''); setSuccess('') }} className="flex-1 rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-700">{ru ? 'Отмена' : 'Bekor qilish'}</button><button disabled={saving} className="flex-1 rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white disabled:opacity-50">{saving ? (ru ? 'Сохранение...' : 'Saqlanmoqda...') : (ru ? 'Сохранить' : 'Saqlash')}</button></div>}</form></div></section>
      <aside className="space-y-5"><section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-slate-900">{ru ? 'Состояние аккаунта' : 'Akkaunt holati'}</h2><div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4"><StatusIcon type="check"/><div><p className="font-extrabold text-emerald-800">{ru ? 'Аккаунт активен' : 'Akkaunt faol'}</p><p className="text-xs text-emerald-700">{ru ? 'Номер телефона подтверждён' : 'Telefon raqami tasdiqlangan'}</p></div></div><div className="mt-4"><div className="flex justify-between text-xs font-bold text-slate-500"><span>{ru ? 'Заполненность профиля' : 'Profil to‘liqligi'}</span><span>{completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${completion}%`}}/></div></div>{!hasName && <p className="mt-4 text-sm text-slate-600">{ru ? 'Введите Ф.И.О., чтобы полностью использовать профиль.' : 'Profilni to‘liq ishlatish uchun F.I.O. ma’lumotini kiriting.'}</p>}</section>
      <section className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><AppIcon name="check" className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h2 className="font-extrabold text-slate-900">{ru ? 'Уведомления Telegram' : 'Telegram bildirishnomalari'}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{ru ? 'Получайте сообщения о новых бронированиях, авансах и отменах.' : 'Yangi bronlar, avans to‘lovlari va bekor qilishlar haqida botdan xabar oling.'}</p><p className={`mt-3 text-xs font-bold ${telegramLinked?'text-emerald-700':'text-amber-700'}`}>{telegramLinked ? (ru ? `Подключено ${telegramUsername ? '@'+telegramUsername : ''}` : `Ulangan ${telegramUsername ? '@'+telegramUsername : ''}`) : (ru ? 'Telegram не подключён' : 'Telegram ulanmagan')}</p>{!telegramLinked && <button type="button" onClick={createTelegramLink} disabled={telegramBusy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{telegramBusy ? (ru?'Создание ссылки...':'Havola yaratilmoqda...') : (ru?'Подключить Telegram':'Telegramni ulash')}</button>}{telegramLinkUrl && !telegramLinked && <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-bold text-sky-700 underline">{ru?'Открыть бота и нажать Start →':'Botni ochib Start bosing →'}</a>}{telegramLinkUrl && !telegramLinked && <button type="button" onClick={refreshTelegramStatus} className="mt-3 block rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">{ru?'Проверить подключение':'Ulanganini tekshirish'}</button>}{telegramError && <p className="mt-2 text-xs text-rose-600">{telegramError}</p>}<p className="mt-2 text-xs leading-5 text-slate-400">{ru?'Ссылка действует 10 минут. После открытия бота нажмите Start.':'Havola 10 daqiqa amal qiladi. Bot ochilgach Start tugmasini bosing.'}</p></div></div></section><section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-slate-900">{ru ? 'Следующие шаги' : 'Keyingi qadamlar'}</h2><div className="mt-4 space-y-3">{actions.map((action,index)=><Link key={`${action.title}-${index}`} href={action.href} className={`flex gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${action.primary?'border-emerald-100 bg-emerald-50':'border-slate-100 bg-slate-50'}`}><StatusIcon type={action.icon}/><span><span className="block font-extrabold text-slate-900">{action.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{action.text}</span></span></Link>)}</div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-start gap-3"><StatusIcon type="help"/><div><h2 className="font-extrabold text-slate-900">{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{ru ? 'Если у вас есть вопросы по услугам Royalhouse, свяжитесь с нами.' : 'Royalhouse xizmatlari bo‘yicha savolingiz bo‘lsa, biz bilan bog‘lanishingiz mumkin.'}</p><Link href="/" className="mt-3 inline-block text-sm font-extrabold text-emerald-700">{ru ? 'Вернуться на главную →' : 'Bosh sahifaga qaytish →'}</Link></div></div></section></aside>
    </div></div></main>
}
