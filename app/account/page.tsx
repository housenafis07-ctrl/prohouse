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
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-slate-200">
      <label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</label>
      {editing && !disabled ? (
        <input value={String(form[field] ?? '')} onChange={e => onChange(field, e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
      ) : (
        <p className="mt-2 truncate font-bold text-slate-900">{value || '—'}</p>
      )}
    </div>
  )
}

function StatusIcon({ type }: { type: 'check' | 'user' | 'home' | 'plus' | 'help' }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><AppIcon name={type} className="h-5 w-5" /></span>
}

function PartnerGrowthBanner({ lang }: { lang: 'uz' | 'ru' }) {
  const [slide, setSlide] = useState(0)
  const slides = lang === 'ru' ? [
    { eyebrow: 'ROYALHOUSE PARTNER', title: 'Больше объявлений — больше клиентов', text: 'Выберите тариф START, PRO или BUSINESS и масштабируйте размещение.', cta: 'Выбрать тариф →', href: '/account/monetization', tone: 'from-slate-950 via-slate-900 to-emerald-950' },
    { eyebrow: 'ПРОДВИЖЕНИЕ', title: 'Покажите объявления выше', text: 'TOP, UP и Highlight помогают привлечь больше внимания покупателей.', cta: 'Продвинуть объявление →', href: '/account/monetization', tone: 'from-emerald-950 via-emerald-900 to-slate-900' },
    { eyebrow: 'ДОВЕРЕННЫЙ ПАРТНЁР', title: 'Больше доверия к вашему бизнесу', text: 'Загрузите необходимые документы и получите статус доверенного партнёра после проверки.', cta: 'Стать доверенным партнёром →', href: '/account/trusted-partner', tone: 'from-indigo-950 via-slate-900 to-emerald-950' },
  ] : [
    { eyebrow: 'ROYALHOUSE PARTNER', title: 'Ko‘proq e’lon — ko‘proq mijoz', text: 'START, PRO yoki BUSINESS tarifini tanlab, biznesingizni kengaytiring.', cta: 'Tarifni tanlash →', href: '/account/monetization', tone: 'from-slate-950 via-slate-900 to-emerald-950' },
    { eyebrow: 'ILGARI SURISH', title: 'E’loningizni yuqoriroqda ko‘rsating', text: 'TOP, UP va Highlight xizmatlari xaridorlar e’tiborini ko‘proq jalb qilishga yordam beradi.', cta: 'E’lonni ilgari surish →', href: '/account/monetization', tone: 'from-emerald-950 via-emerald-900 to-slate-900' },
    { eyebrow: 'ISHONCHLI HAMKOR', title: 'Biznesingizga ko‘proq ishonch', text: 'Zarur hujjatlarni yuklang va tekshiruvdan so‘ng Ishonchli hamkor maqomini oling.', cta: 'Ishonchli hamkor bo‘lish →', href: '/account/trusted-partner', tone: 'from-indigo-950 via-slate-900 to-emerald-950' },
  ]

  useEffect(() => {
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  const current = slides[slide]
  return (
    <section className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${current.tone} p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:p-8`}>
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute bottom-[-80px] left-1/3 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex min-h-[205px] flex-col justify-between sm:min-h-[190px]">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-emerald-200">{current.eyebrow}</span>
          <h2 className="mt-4 max-w-2xl text-2xl font-black tracking-tight sm:text-4xl">{current.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{current.text}</p>
          <Link href={current.href} className="mt-5 inline-flex items-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">{current.cta}</Link>
        </div>
        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="text-xs font-bold text-white/45">{lang === 'ru' ? 'Специальные предложения для партнёров' : 'Hamkorlar uchun maxsus takliflar'}</span>
          <div className="flex gap-1.5" aria-label="Banner slides">{slides.map((_, index) => <button key={index} type="button" onClick={() => setSlide(index)} aria-label={`${index + 1}-banner`} className={`h-2 rounded-full transition-all ${index === slide ? 'w-7 bg-white' : 'w-2 bg-white/40'}`} />)}</div>
        </div>
      </div>
    </section>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { lang, setLang } = useI18n()
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
      if (!data) { router.replace('/register?next=%2Faccount'); return }
      setProfile(data)
      setForm(data)
      const { data: completeness, error: completenessError } = await supabase.rpc('get_seller_profile_completeness')
      if (mounted) {
        if (completenessError) setError(prev => prev || completenessError.message)
        if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent)
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
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
    } finally { setTelegramBusy(false) }
  }

  const setField = (key: keyof Profile, value: string) => setForm(v => v ? { ...v, [key]: value } : v)

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.full_name?.trim()) { setError(lang === 'ru' ? 'Введите Ф.И.О.' : 'F.I.O. ni kiriting.'); return }
    if (form.account_type === 'partner' && !form.inn?.trim()) { setError(lang === 'ru' ? 'Введите ИНН.' : 'INN ni kiriting.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/register'); return }
      const response = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: form.full_name.trim(), account_type: form.account_type || 'individual', partner_type: form.partner_type, company_name: form.company_name?.trim() || '', inn: form.inn?.trim() || '', bank_name: form.bank_name?.trim() || '', bank_account: form.bank_account?.trim() || '', mfo: form.mfo?.trim() || '', oked: form.oked?.trim() || '', director_full_name: form.director_full_name?.trim() || '' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || (lang === 'ru' ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik'))
      const data = result.profile as Profile
      setProfile(data); setForm(data)
      const { data: completeness, error: completenessError } = await supabase.rpc('get_seller_profile_completeness')
      if (completenessError) throw completenessError
      if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent)
      setEditing(false)
      setSuccess(lang === 'ru' ? 'Данные профиля сохранены.' : 'Profil ma’lumotlari saqlandi.')
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === 'ru' ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik'))
    } finally { setSaving(false) }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  if (loading) return <main className="min-h-screen bg-[#f6f8fb] px-4 py-10"><div className="mx-auto max-w-6xl rounded-[28px] bg-white p-10 text-center shadow-sm">{lang === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}</div></main>
  if (!profile || !form) return <main className="min-h-screen bg-[#f6f8fb] px-4 py-10"><div className="mx-auto max-w-xl rounded-[28px] bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-extrabold text-slate-900">{lang === 'ru' ? 'Профиль не загружен' : 'Profil yuklanmadi'}</h1><p className="mt-3 text-sm text-slate-600">{error || (lang === 'ru' ? 'Обновите страницу и попробуйте снова.' : 'Sahifani yangilab qayta urinib ko‘ring.')}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</button><Link href="/" className="mt-4 block text-sm font-bold text-emerald-700">{lang === 'ru' ? 'На главную' : 'Bosh sahifaga qaytish'}</Link></div></main>

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

  return (
    <main className="min-h-screen bg-[#f5f7fa] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
          <Link href="/" className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">⌂</span>RoyalHouse.uz</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">{ru ? 'O‘z' : 'Ru'}</button>
            <button type="button" onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:text-rose-600">{ru ? 'Выйти' : 'Chiqish'}</button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_8px_35px_rgba(15,23,42,0.07)]">
              <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-100/70 blur-3xl" />
              <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">{ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}</p>
                  <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{profile.full_name || (ru ? 'Пользователь RoyalHouse' : 'RoyalHouse foydalanuvchisi')} <span className="inline-block">👋</span></h1>
                  <p className="mt-2 text-sm text-slate-500">{ru ? 'Управляйте объявлениями, бронированиями и настройками профиля.' : 'E’lonlar, bronlar va profil sozlamalarini bir joydan boshqaring.'}</p>
                </div>
                <Link href="/listings/new" className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700">＋ {ru ? 'Разместить объявление' : 'E’lon joylashtirish'}</Link>
              </div>
            </section>

            {isPartner && <PartnerGrowthBanner lang={lang} />}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {actions.map((action, index) => <Link key={`${action.title}-${index}`} href={action.href} className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${action.primary ? 'border-emerald-100 bg-emerald-50/80' : 'border-slate-200 bg-white'}`}><div className="flex items-start gap-3"><StatusIcon type={action.icon}/><div className="min-w-0"><h2 className="font-black text-slate-900">{action.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{action.text}</p><span className="mt-3 inline-flex text-xs font-black text-emerald-700 group-hover:translate-x-0.5">{ru ? 'Открыть →' : 'Ochish →'}</span></div></div></Link>)}
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.06)] sm:p-7" id="profile">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{ru ? 'Профиль' : 'Profil'}</p><h2 className="mt-1 text-xl font-black text-slate-950">{ru ? 'Личные данные' : 'Shaxsiy ma’lumotlar'}</h2><p className="mt-1 text-sm text-slate-500">{ru ? 'Основные данные вашего аккаунта.' : 'Akkauntingizning asosiy ma’lumotlari.'}</p></div>
                {!editing && <button type="button" onClick={() => { setForm(profile); setEditing(true); setError(''); setSuccess('') }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">{ru ? 'Редактировать' : 'Tahrirlash'}</button>}
              </div>

              <form onSubmit={saveProfile} className="mt-5">
                {editing && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800">{ru ? 'Подтверждённый номер телефона привязан к аккаунту и не изменяется здесь.' : 'Telefon raqami tasdiqlangan akkauntga bog‘langan va bu yerda o‘zgartirilmaydi.'}</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProfileField label="F.I.O." value={display.full_name} form={form} field="full_name" editing={editing} required onChange={setField}/>
                  <ProfileField label={ru ? 'Номер телефона' : 'Telefon raqami'} value={display.phone} form={form} field="phone" editing={editing} disabled onChange={setField}/>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{ru ? 'Тип аккаунта' : 'Akkaunt turi'}</label>{editing ? <select value={form.account_type || 'individual'} onChange={e => setField('account_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900"><option value="individual">{ru ? 'Физическое лицо' : 'Jismoniy shaxs'}</option><option value="partner">{ru ? 'Партнёр' : 'Hamkor'}</option></select> : <p className="mt-2 font-bold text-slate-900">{isPartner ? (ru ? 'Партнёр' : 'Hamkor') : (ru ? 'Физическое лицо' : 'Jismoniy shaxs')}</p>}</div>
                  {showPartnerFields && <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{ru ? 'Организационно-правовая форма' : 'Hamkorning huquqiy shakli'}</label>{editing ? <select value={form.partner_type || 'self_employed'} onChange={e => setField('partner_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold"><option value="self_employed">{partnerLabels.self_employed[lang]}</option><option value="sole_proprietor">{partnerLabels.sole_proprietor[lang]}</option><option value="llc">{partnerLabels.llc[lang]}</option></select> : <p className="mt-2 font-bold text-slate-900">{partnerLabels[profile.partner_type || '']?.[lang] || '—'}</p>}</div>}
                  {showPartnerFields && <ProfileField label="INN" value={display.inn} form={form} field="inn" editing={editing} required onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Организация' : 'Tashkilot'} value={display.company_name} form={form} field="company_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Ф.И.О. руководителя' : 'Rahbar F.I.O.'} value={display.director_full_name} form={form} field="director_full_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Название банка' : 'Bank nomi'} value={display.bank_name} form={form} field="bank_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Расчётный счёт' : 'Hisob raqami'} value={display.bank_account} form={form} field="bank_account" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="МФО" value={display.mfo} form={form} field="mfo" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="ОКЭД" value={display.oked} form={form} field="oked" editing={editing} onChange={setField}/>} 
                </div>
                {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
                {success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
                {editing && <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError(''); setSuccess('') }} className="flex-1 rounded-2xl border border-slate-200 px-5 py-3.5 font-bold text-slate-700">{ru ? 'Отмена' : 'Bekor qilish'}</button><button disabled={saving} className="flex-1 rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-emerald-600/15 disabled:opacity-50">{saving ? (ru ? 'Сохранение...' : 'Saqlanmoqda...') : (ru ? 'Сохранить' : 'Saqlash')}</button></div>}
              </form>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{ru ? 'Профиль' : 'Profil'}</p><h2 className="mt-1 text-lg font-black text-slate-950">{ru ? 'Состояние профиля' : 'Profil holati'}</h2></div><span className="text-2xl font-black text-emerald-600">{completion}%</span></div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}/></div>
              <div className="mt-4 space-y-3 text-sm"><div className="flex items-center gap-2 text-slate-700"><span className="text-emerald-600">✓</span>{ru ? 'Основные данные' : 'Asosiy ma’lumotlar'}</div><div className="flex items-center gap-2 text-slate-700"><span className="text-emerald-600">✓</span>{ru ? 'Номер телефона' : 'Telefon raqami'}</div><div className="flex items-center gap-2 text-slate-700"><span className={isPartner && profile.company_name ? 'text-emerald-600' : 'text-slate-300'}>✓</span>{ru ? 'Данные компании' : 'Firma ma’lumotlari'}</div><div className="flex items-center gap-2 text-slate-700"><span className="text-slate-300">○</span>{ru ? 'Социальные сети' : 'Ijtimoiy tarmoqlar'}</div></div>
              {!hasName && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{ru ? 'Введите Ф.И.О., чтобы полностью использовать профиль.' : 'Profilni to‘liq ishlatish uchun F.I.O. ma’lumotini kiriting.'}</p>}
            </section>

            <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm"><AppIcon name="home" className="h-5 w-5"/></span><div><p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-600">{ru ? 'Лимит' : 'Limit'}</p><h2 className="mt-1 font-black text-slate-950">{ru ? 'Объявления' : 'E’lonlar'}</h2><p className="mt-2 text-sm leading-5 text-slate-600">{isPartner ? (ru ? 'Для партнёра доступно 5 бесплатных объявлений.' : 'Hamkor uchun 5 ta bepul e’lon limiti mavjud.') : (ru ? 'Для физического лица доступно 3 бесплатных объявления.' : 'Jismoniy shaxs uchun 3 ta bepul e’lon limiti mavjud.')}</p><Link href="/account/monetization" className="mt-4 inline-flex text-sm font-black text-emerald-700">{isPartner ? (ru ? 'Увеличить лимит →' : 'Limitni oshirish →') : (ru ? 'Подробнее →' : 'Batafsil →')}</Link></div></div></section>

            <section className="rounded-[28px] border border-sky-100 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><AppIcon name="check" className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.1em] text-sky-600">Telegram</p><h2 className="mt-1 font-black text-slate-950">{ru ? 'Уведомления' : 'Bildirishnomalar'}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{ru ? 'Получайте сообщения о новых бронированиях, авансах и отменах.' : 'Yangi bronlar, avans to‘lovlari va bekor qilishlar haqida botdan xabar oling.'}</p><p className={`mt-3 text-xs font-black ${telegramLinked ? 'text-emerald-700' : 'text-amber-700'}`}>{telegramLinked ? (ru ? `Подключено ${telegramUsername ? '@' + telegramUsername : ''}` : `Ulangan ${telegramUsername ? '@' + telegramUsername : ''}`) : (ru ? 'Telegram не подключён' : 'Telegram ulanmagan')}</p>{!telegramLinked && <button type="button" onClick={createTelegramLink} disabled={telegramBusy} className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{telegramBusy ? (ru ? 'Создание ссылки...' : 'Havola yaratilmoqda...') : (ru ? 'Подключить Telegram' : 'Telegramni ulash')}</button>}{telegramLinkUrl && !telegramLinked && <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs font-bold text-sky-700 underline">{ru ? 'Открыть бота и нажать Start →' : 'Botni ochib Start bosing →'}</a>}{telegramLinkUrl && !telegramLinked && <button type="button" onClick={refreshTelegramStatus} className="mt-3 block rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">{ru ? 'Проверить подключение' : 'Ulanganini tekshirish'}</button>}{telegramError && <p className="mt-2 text-xs text-rose-600">{telegramError}</p>}<p className="mt-2 text-[11px] leading-5 text-slate-400">{ru ? 'Ссылка действует 10 минут. После открытия бота нажмите Start.' : 'Havola 10 daqiqa amal qiladi. Bot ochilgach Start bosing.'}</p></div></div></section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><StatusIcon type="help"/><div><p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{ru ? 'Поддержка' : 'Qo‘llab-quvvatlash'}</p><h2 className="mt-1 font-black text-slate-950">{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}</h2><p className="mt-2 text-sm leading-5 text-slate-500">{ru ? 'Если у вас есть вопросы по услугам RoyalHouse, свяжитесь с нами.' : 'RoyalHouse xizmatlari bo‘yicha savolingiz bo‘lsa, biz bilan bog‘lanishingiz mumkin.'}</p><Link href="/" className="mt-3 inline-flex text-sm font-black text-emerald-700">{ru ? 'На главную →' : 'Bosh sahifaga →'}</Link></div></div></section>
          </aside>
        </div>
      </div>
    </main>
  )
}
