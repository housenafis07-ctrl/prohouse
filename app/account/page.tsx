'use client'

import { FormEvent, ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

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
  return <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</label>{editing && !disabled ? <input value={String(form[field] ?? '')} onChange={e => onChange(field, e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /> : <p className="mt-2 truncate text-sm font-bold text-slate-900">{value || '—'}</p>}</div>
}

function NavIcon({ children }: { children: ReactNode }) { return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-sm">{children}</span> }

export default function AccountPage() {
  const router = useRouter()
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
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
      if (profileError) { setError(ru ? 'Не удалось проверить профиль. Обновите страницу и попробуйте снова.' : 'Profilni tekshirib bo‘lmadi. Sahifani yangilab qayta urinib ko‘ring.'); setLoading(false); return }
      if (!data) { router.replace('/register?next=%2Faccount'); return }
      setProfile(data); setForm(data)
      const { data: completeness } = await supabase.rpc('get_seller_profile_completeness')
      if (mounted) { if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent); setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [router, ru])

  useEffect(() => {
    let active = true
    fetch('/api/account/telegram/link', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (active && response.ok) { setTelegramLinked(Boolean(data.linked)); setTelegramUsername(data.username || null) } }).catch(() => {})
    return () => { active = false }
  }, [])

  async function refreshTelegramStatus() {
    try { const response = await fetch('/api/account/telegram/link', { cache: 'no-store' }); const data = await response.json(); if (response.ok) { setTelegramLinked(Boolean(data.linked)); setTelegramUsername(data.username || null); if (data.linked) setTelegramLinkUrl('') } } catch {}
  }

  async function createTelegramLink() {
    setTelegramBusy(true); setTelegramError('')
    try { const response = await fetch('/api/account/telegram/link', { method: 'POST' }); const data = await response.json(); if (!response.ok || !data.url) throw new Error(data.error || (ru ? 'Не удалось создать ссылку.' : 'Ulash havolasini yaratib bo‘lmadi.')); setTelegramLinkUrl(data.url) }
    catch (e) { setTelegramError(e instanceof Error ? e.message : (ru ? 'Ошибка Telegram.' : 'Telegram xatosi.')) }
    finally { setTelegramBusy(false) }
  }

  const setField = (key: keyof Profile, value: string) => setForm(v => v ? { ...v, [key]: value } : v)

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); if (!form) return
    if (!form.full_name?.trim()) { setError(ru ? 'Введите Ф.И.О.' : 'F.I.O. ni kiriting.'); return }
    if (form.account_type === 'partner' && !form.inn?.trim()) { setError(ru ? 'Введите ИНН.' : 'INN ni kiriting.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace('/register'); return }
      const response = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: form.full_name.trim(), account_type: form.account_type || 'individual', partner_type: form.partner_type, company_name: form.company_name?.trim() || '', inn: form.inn?.trim() || '', bank_name: form.bank_name?.trim() || '', bank_account: form.bank_account?.trim() || '', mfo: form.mfo?.trim() || '', oked: form.oked?.trim() || '', director_full_name: form.director_full_name?.trim() || '' }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || (ru ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik'))
      const data = result.profile as Profile; setProfile(data); setForm(data)
      const { data: completeness } = await supabase.rpc('get_seller_profile_completeness'); if (typeof completeness?.completion_percent === 'number') setCompletion(completeness.completion_percent)
      setEditing(false); setSuccess(ru ? 'Данные профиля сохранены.' : 'Profil ma’lumotlari saqlandi.')
    } catch (e) { setError(e instanceof Error ? e.message : (ru ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik')) }
    finally { setSaving(false) }
  }

  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/'); router.refresh() }

  if (loading) return <main className="min-h-screen bg-[#f4f7f8] p-6"><div className="mx-auto max-w-7xl rounded-3xl bg-white p-12 text-center shadow-sm">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div></main>
  if (!profile || !form) return <main className="min-h-screen bg-[#f4f7f8] p-6"><div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">{ru ? 'Профиль не загружен' : 'Profil yuklanmadi'}</h1><p className="mt-3 text-sm text-slate-500">{error}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{ru ? 'Повторить' : 'Qayta urinish'}</button></div></main>

  const isPartner = profile.account_type === 'partner'
  const showPartnerFields = editing ? form.account_type === 'partner' : isPartner
  const display = editing ? form : profile
  const navPrimary = [
    ['🏠', ru ? 'Кабинет' : 'Kabinet', '/account'],
    ['＋', ru ? 'Разместить объявление' : 'E’lon joylashtirish', '/listings/new'],
    ['▣', ru ? 'Мои объявления' : 'Mening e’lonlarim', '/account/listings'],
    ['✓', ru ? 'Мои бронирования' : 'Mening bronlarim', '/account/bookings'],
    ['🏠', ru ? 'Ипотечные заявки' : 'Ipoteka arizalarim', '/account/mortgage'],
    ['💬', ru ? 'Сообщения' : 'Xabarlar', '/chat'],
    ['♡', ru ? 'Избранное' : 'Saqlanganlar', '/account/favorites'],
    ['⌕', ru ? 'Сохранённые поиски' : 'Saqlangan qidiruvlar', '/account/saved-searches'],
  ] as const
  const navSeller = [
    ['✓', ru ? 'Надёжный профиль' : 'Ishonchli profil', '/account/trusted-profile'],
    ['★', ru ? 'Продвижение объявления' : 'E’lonni ilgari surish', '/account/monetization'],
    ...(isPartner ? [['🏢', ru ? 'Профиль компании' : 'Firma profili', '/account/company-profile'] as const] : []),
    ['₿', ru ? 'Счёт и платежи' : 'Hisob va to‘lovlar', '/account/wallet'],
  ] as const
  const statCards = [
    { icon: '▣', label: ru ? 'Все объявления' : 'Barcha e’lonlar', href: '/account/listings', tone: 'bg-emerald-50 text-emerald-700' },
    { icon: '●', label: ru ? 'Активные объявления' : 'Faol e’lonlar', href: '/account/listings', tone: 'bg-green-50 text-green-700' },
    { icon: '✕', label: ru ? 'Отклонённые' : 'Rad etilgan', href: '/account/listings', tone: 'bg-rose-50 text-rose-600' },
    { icon: '✓', label: ru ? 'Проданные' : 'Sotilgan', href: '/account/listings', tone: 'bg-blue-50 text-blue-600' },
    { icon: '⌕', label: ru ? 'Сданы в аренду' : 'Ijaraga berilgan', href: '/account/listings', tone: 'bg-violet-50 text-violet-600' },
    { icon: '▤', label: ru ? 'Архив' : 'Arxiv', href: '/account/listings', tone: 'bg-slate-100 text-slate-600' },
  ]

  return <main className="min-h-screen bg-[#f4f7f8] text-slate-950">
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[218px] shrink-0 border-r border-slate-200/80 bg-white lg:flex lg:flex-col">
        <div className="flex h-[74px] items-center gap-2 border-b border-slate-100 px-5"><Link href="/" className="flex items-center gap-2 font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg">🏠</span>RoyalHouse.uz</Link></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navPrimary.map(([icon, label, href], index) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${index === 0 ? 'bg-emerald-100/80 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><NavIcon>{icon}</NavIcon>{label}</Link>)}
          <div className="my-4 border-t border-slate-100" />
          {navSeller.map(([icon, label, href]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"><NavIcon>{icon}</NavIcon>{label}</Link>)}
          <button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50"><NavIcon>文</NavIcon>{ru ? 'O‘z / Ru' : 'O‘z / Ru'}</button>
        </nav>
        <button type="button" onClick={signOut} className="m-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-bold text-slate-500 hover:border-rose-200 hover:text-rose-600">↪ {ru ? 'Выйти' : 'Chiqish'}</button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 xl:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-black lg:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">🏠</span>RoyalHouse</Link>
            <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-400 md:flex"><span>⌕</span>{ru ? 'Дом, квартира, дача, офис, район...' : 'Uy, kvartira, dacha, ofis, yer...'}</div>
            <div className="ml-auto flex items-center gap-2"><Link href="/account/favorites" className="rounded-xl p-2 text-slate-600 hover:bg-slate-50">♡</Link><Link href="/chat" className="rounded-xl p-2 text-slate-600 hover:bg-slate-50">💬</Link><button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">{ru ? 'O‘z / Ru' : 'O‘z / Ru'}</button><span className="hidden text-right sm:block"><b className="block text-xs font-black">{profile.company_name || profile.full_name || 'RoyalHouse'}</b><small className="text-[10px] text-slate-400">{isPartner ? (ru ? 'Партнёр' : 'Hamkor') : (ru ? 'Пользователь' : 'Foydalanuvchi')}</small></span></div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 xl:px-8">
          <section className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">{ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{ru ? 'Здравствуйте' : 'Assalomu alaykum'}, {profile.full_name || 'RoyalHouse'}! 👋</h1><p className="mt-1 text-sm text-slate-500">{ru ? 'Управляйте объявлениями, бронированиями и настройками профиля в одном месте.' : 'E’lonlar, bronlar va profil sozlamalarini bir joydan boshqaring.'}</p></div><Link href="/listings/new" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">＋ {ru ? 'Разместить объявление' : 'E’lon joylashtirish'}</Link></section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{statCards.map(card => <Link key={card.label} href={card.href} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>{card.icon}</div><p className="text-xs font-bold text-slate-500">{card.label}</p><p className="mt-1 text-xl font-black text-slate-900">—</p></Link>)}</section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              {isPartner && <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-emerald-100 via-green-50 to-sky-50 p-5 shadow-sm sm:p-7"><div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(16,185,129,.22),transparent_58%)]"/><div className="relative max-w-2xl"><span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">{ru ? 'Продвижение объявления' : 'E’lonni ilgari surish'}</span><h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{ru ? 'Покажите объявление выше и быстрее найдите клиента' : 'Ko‘proq xaridorga ko‘rining, tezroq soting yoki ijaraga bering'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{ru ? 'TOP, Highlight и тарифы START, PRO, BUSINESS помогают увеличить охват ваших объявлений.' : 'TOP, Highlight hamda START, PRO, BUSINESS tariflari e’lonlaringiz qamrovini oshirishga yordam beradi.'}</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/account/monetization" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">{ru ? 'Продвинуть объявление →' : 'E’lonni ilgari surish →'}</Link><Link href="/account/monetization" className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-emerald-700 shadow-sm">{ru ? 'Выбрать тариф' : 'Tarifni tanlash'}</Link></div></div></section>}

              <section className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">{ru ? 'Быстрые действия' : 'Tezkor amallar'}</h2><p className="mt-1 text-xs text-slate-400">{ru ? 'Часто используемые разделы' : 'Ko‘p ishlatiladigan bo‘limlar'}</p></div><Link href="/account" className="text-xs font-black text-emerald-600">{ru ? 'Все →' : 'Barchasi →'}</Link></div><div className="grid gap-3 sm:grid-cols-3"><Link href="/listings/new" className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 hover:border-emerald-200"><span className="text-xl">＋</span><h3 className="mt-4 font-black">{ru ? 'Разместить объявление' : 'E’lon joylashtirish'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Продать или сдать недвижимость' : 'Mulkni sotish yoki ijaraga berish'}</p></Link><Link href="/account/listings" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-200"><span className="text-xl">🏠</span><h3 className="mt-4 font-black">{ru ? 'Мои объявления' : 'Mening e’lonlarim'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Редактировать и управлять' : 'Tahrirlash va boshqarish'}</p></Link><Link href="/account/bookings" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-200"><span className="text-xl">✓</span><h3 className="mt-4 font-black">{ru ? 'Мои бронирования' : 'Mening bronlarim'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Статусы броней и оплат' : 'Bron va to‘lov holatlari'}</p></Link></div></section>

              <section className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6" id="profile"><div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ru ? 'Профиль' : 'Profil'}</p><h2 className="mt-1 text-xl font-black">{ru ? 'Личные данные' : 'Shaxsiy ma’lumotlar'}</h2></div>{!editing && <button type="button" onClick={() => { setForm(profile); setEditing(true); setError(''); setSuccess('') }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black hover:border-emerald-300">{ru ? 'Редактировать' : 'Tahrirlash'}</button>}</div><form onSubmit={saveProfile} className="mt-5"><div className="grid gap-3 sm:grid-cols-2"><ProfileField label="F.I.O." value={display.full_name} form={form} field="full_name" editing={editing} required onChange={setField}/><ProfileField label={ru ? 'Номер телефона' : 'Telefon raqami'} value={display.phone} form={form} field="phone" editing={editing} disabled onChange={setField}/><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{ru ? 'Тип аккаунта' : 'Akkaunt turi'}</label>{editing ? <select value={form.account_type || 'individual'} onChange={e => setField('account_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"><option value="individual">{ru ? 'Физическое лицо' : 'Jismoniy shaxs'}</option><option value="partner">{ru ? 'Партнёр' : 'Hamkor'}</option></select> : <p className="mt-2 text-sm font-bold">{isPartner ? (ru ? 'Партнёр' : 'Hamkor') : (ru ? 'Физическое лицо' : 'Jismoniy shaxs')}</p>}</div>{showPartnerFields && <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{ru ? 'Организационно-правовая форма' : 'Hamkorning huquqiy shakli'}</label>{editing ? <select value={form.partner_type || 'self_employed'} onChange={e => setField('partner_type', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"><option value="self_employed">{partnerLabels.self_employed[lang]}</option><option value="sole_proprietor">{partnerLabels.sole_proprietor[lang]}</option><option value="llc">{partnerLabels.llc[lang]}</option></select> : <p className="mt-2 text-sm font-bold">{partnerLabels[profile.partner_type || '']?.[lang] || '—'}</p>}</div>}{showPartnerFields && <ProfileField label="INN" value={display.inn} form={form} field="inn" editing={editing} required onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Организация' : 'Tashkilot'} value={display.company_name} form={form} field="company_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Ф.И.О. руководителя' : 'Rahbar F.I.O.'} value={display.director_full_name} form={form} field="director_full_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Название банка' : 'Bank nomi'} value={display.bank_name} form={form} field="bank_name" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label={ru ? 'Расчётный счёт' : 'Hisob raqami'} value={display.bank_account} form={form} field="bank_account" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="МФО" value={display.mfo} form={form} field="mfo" editing={editing} onChange={setField}/>} {showPartnerFields && <ProfileField label="ОКЭД" value={display.oked} form={form} field="oked" editing={editing} onChange={setField}/>}</div>{error && <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}{success && <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}{editing && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError(''); setSuccess('') }} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold">{ru ? 'Отмена' : 'Bekor qilish'}</button><button disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? (ru ? 'Сохранение...' : 'Saqlanmoqda...') : (ru ? 'Сохранить' : 'Saqlash')}</button></div>}</form></section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[24px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ru ? 'Профиль' : 'Profil'}</p><h2 className="mt-1 text-lg font-black">{ru ? 'Состояние профиля' : 'Profil holati'}</h2></div><strong className="text-2xl font-black text-emerald-600">{completion}%</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}/></div><div className="mt-4 space-y-2.5 text-xs font-semibold text-slate-600"><div>✓ {ru ? 'Основные данные' : 'Asosiy ma’lumotlar'}</div><div>✓ {ru ? 'Номер телефона' : 'Telefon raqami'}</div><div className={isPartner && profile.company_name ? 'text-emerald-700' : 'text-slate-400'}>✓ {ru ? 'Данные компании' : 'Firma ma’lumotlari'}</div><div className="text-slate-400">○ {ru ? 'Социальные сети' : 'Ijtimoiy tarmoqlar'}</div></div></section>

              <section className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{ru ? 'Лимит' : 'Limit'}</p><h2 className="mt-1 text-lg font-black">{ru ? 'Объявления' : 'E’lonlar'}</h2><p className="mt-2 text-sm leading-5 text-slate-600">{isPartner ? (ru ? 'Для партнёра доступно 5 бесплатных объявлений.' : 'Hamkor uchun 5 ta bepul e’lon limiti mavjud.') : (ru ? 'Для физического лица доступно 3 бесплатных объявления.' : 'Jismoniy shaxs uchun 3 ta bepul e’lon limiti mavjud.')}</p><Link href="/account/monetization" className="mt-4 inline-flex text-sm font-black text-emerald-700">{isPartner ? (ru ? 'Увеличить лимит →' : 'Limitni oshirish →') : (ru ? 'Подробнее →' : 'Batafsil →')}</Link></section>

              <section className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50">✈️</span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Telegram</p><h2 className="mt-1 text-lg font-black">{ru ? 'Уведомления' : 'Bildirishnomalar'}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Новые бронирования, авансы и отмены — прямо в боте.' : 'Yangi bronlar, avanslar va bekor qilishlar — to‘g‘ridan-to‘g‘ri botda.'}</p><p className={`mt-3 text-xs font-black ${telegramLinked ? 'text-emerald-700' : 'text-amber-700'}`}>{telegramLinked ? (ru ? `Подключено ${telegramUsername ? '@' + telegramUsername : ''}` : `Ulangan ${telegramUsername ? '@' + telegramUsername : ''}`) : (ru ? 'Telegram не подключён' : 'Telegram ulanmagan')}</p>{!telegramLinked && <button type="button" onClick={createTelegramLink} disabled={telegramBusy} className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{telegramBusy ? (ru ? 'Создание...' : 'Yaratilmoqda...') : (ru ? 'Подключить Telegram' : 'Telegramni ulash')}</button>}{telegramLinkUrl && !telegramLinked && <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-3 block text-xs font-bold text-sky-700 underline">{ru ? 'Открыть бота и нажать Start →' : 'Botni ochib Start bosing →'}</a>}{telegramLinkUrl && !telegramLinked && <button type="button" onClick={refreshTelegramStatus} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{ru ? 'Проверить подключение' : 'Ulanganini tekshirish'}</button>}{telegramError && <p className="mt-2 text-xs text-rose-600">{telegramError}</p>}</div></div></section>

              <section className="rounded-[24px] bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ru ? 'Помощь' : 'Yordam'}</p><h2 className="mt-1 text-lg font-black">{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{ru ? 'Мы поможем разобраться с услугами RoyalHouse.' : 'RoyalHouse xizmatlari bo‘yicha yordam beramiz.'}</p><Link href="/" className="mt-3 inline-flex text-sm font-black text-emerald-700">{ru ? 'Открыть центр помощи →' : 'Yordam markazi →'}</Link></section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  </main>
}
