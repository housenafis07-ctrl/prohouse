'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'
import AccountListingsPreview from './AccountListingsPreview'

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
  email: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  telegram_url: string | null
}

type Stats = {
  total: number
  active: number
  moderation: number
  rejected: number
  sold: number
  rented: number
  archived: number
}

type IconProps = { children: ReactNode }

function Icon({ children }: IconProps) {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">{children}</span>
}

function MenuLink({ href, active, icon, children, onClick }: { href: string; active?: boolean; icon: ReactNode; children: ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick ? (event) => { event.preventDefault(); onClick() } : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
      <Icon>{icon}</Icon><span className="truncate">{children}</span>
    </Link>
  )
}

function ProfileField({ label, value, form, field, editing, required = false, disabled = false, onChange }: {
  label: string
  value: string | null
  form: Profile
  field: keyof Profile
  editing: boolean
  required?: boolean
  disabled?: boolean
  onChange: (field: keyof Profile, value: string) => void
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</label>
      {editing && !disabled ? (
        <input value={String(form[field] ?? '')} onChange={(event) => onChange(field, event.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
      ) : (
        <p className="mt-2 truncate text-sm font-bold text-slate-900">{value || '—'}</p>
      )}
    </div>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, moderation: 0, rejected: 0, sold: 0, rented: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [telegramLinkUrl, setTelegramLinkUrl] = useState('')
  const [telegramBusy, setTelegramBusy] = useState(false)
  const [telegramError, setTelegramError] = useState('')
  const [openingRealtorCabinet, setOpeningRealtorCabinet] = useState(false)

  const loadTelegramStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/account/telegram/link', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) return
      setTelegramLinked(Boolean(data.linked))
      setTelegramUsername(data.username || null)
      if (data.linked) {
        setTelegramLinkUrl('')
        setTelegramError('')
      }
    } catch {
      // Keep the last known status.
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/account/stats', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) return
      setStats({
        total: data.total ?? 0,
        active: data.active ?? 0,
        moderation: data.moderation ?? 0,
        rejected: data.rejected ?? 0,
        sold: data.sold ?? 0,
        rented: data.rented ?? 0,
        archived: data.archived ?? 0,
      })
    } catch {
      // Keep previous values.
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        // The cabinet must not depend on the browser Supabase auth lock. OTP
        // login already established the session cookie; the server endpoint
        // validates that cookie and reads the profile directly. The previous
        // client-side getSession()/profiles query could remain pending and
        // leave the entire cabinet on "Yuklanmoqda...".
        const response = await Promise.race([
          fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PROFILE_LOAD_TIMEOUT')), 8000)),
        ])
        const result = await response.json().catch(() => ({}))

        if (!mounted) return
        if (response.status === 401 && (result.error === 'AUTH_REQUIRED' || result.error === 'PHONE_AUTH_REQUIRED')) {
          router.replace('/account/login?next=%2Faccount')
          return
        }
        if (!response.ok || !result.profile) {
          throw new Error(result.error || (ru ? 'Не удалось загрузить профиль.' : 'Profilni yuklab bo‘lmadi.'))
        }

        const nextProfile = result.profile as Profile
        setProfile(nextProfile)
        setForm(nextProfile)
        setLoading(false)

        // Auxiliary dashboard values never block the cabinet from rendering.
        void loadStats()
        void loadTelegramStatus()
      } catch (loadError) {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : (ru ? 'Не удалось загрузить профиль.' : 'Profilni yuklab bo‘lmadi.'))
        setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [router, ru, loadStats, loadTelegramStatus])

  useEffect(() => {
    if (telegramLinked) return
    const interval = window.setInterval(() => void loadTelegramStatus(), 3000)
    return () => window.clearInterval(interval)
  }, [telegramLinked, loadTelegramStatus])

  const setField = (key: keyof Profile, value: string) => {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    if (!form.full_name?.trim()) {
      setError(ru ? 'Введите Ф.И.О.' : 'F.I.O. ni kiriting.')
      return
    }
    if (form.account_type === 'partner' && !form.inn?.trim()) {
      setError(ru ? 'Введите ИНН.' : 'INN ni kiriting.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          account_type: form.account_type || 'individual',
          partner_type: form.partner_type,
          company_name: form.company_name?.trim() || '',
          inn: form.inn?.trim() || '',
          bank_name: form.bank_name?.trim() || '',
          bank_account: form.bank_account?.trim() || '',
          mfo: form.mfo?.trim() || '',
          oked: form.oked?.trim() || '',
          director_full_name: form.director_full_name?.trim() || '',
          email: form.email?.trim() || '',
          instagram_url: form.instagram_url?.trim() || '',
          facebook_url: form.facebook_url?.trim() || '',
          linkedin_url: form.linkedin_url?.trim() || '',
          telegram_url: form.telegram_url?.trim() || '',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || (ru ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik.'))
      setProfile(result.profile as Profile)
      setForm(result.profile as Profile)
      setEditing(false)
      setSuccess(ru ? 'Данные профиля сохранены.' : 'Profil ma’lumotlari saqlandi.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (ru ? 'Ошибка сохранения.' : 'Saqlashda xatolik.'))
    } finally {
      setSaving(false)
    }
  }

  async function createTelegramLink() {
    setTelegramBusy(true)
    setTelegramError('')
    try {
      const response = await fetch('/api/account/telegram/link', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || (ru ? 'Не удалось создать ссылку.' : 'Ulash havolasini yaratib bo‘lmadi.'))
      setTelegramLinkUrl(data.url)
    } catch (linkError) {
      setTelegramError(linkError instanceof Error ? linkError.message : (ru ? 'Ошибка Telegram.' : 'Telegram xatosi.'))
    } finally {
      setTelegramBusy(false)
    }
  }

  async function openRealtorCabinet() {
    if (openingRealtorCabinet) return
    setOpeningRealtorCabinet(true)
    try {
      const response = await fetch('/api/realtors/cabinet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ intent: 'handoff' }),
      })
      if (!response.ok) throw new Error('HANDOFF_NOT_CREATED')
      router.push('/realtors/cabinet')
    } catch {
      // Fall back to the public entry: it will require normal SMS verification.
      router.push('/realtors/cabinet')
    } finally {
      setOpeningRealtorCabinet(false)
    }
  }

  async function signOut() {
    try {
      const clearResponse = await fetch('/api/auth/clear-account-session', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!clearResponse.ok) throw new Error('ACCOUNT_SESSION_CLEAR_FAILED')
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/')
      router.refresh()
    } catch (signOutError) {
      console.error('[account] sign out failed', signOutError)
      window.alert(ru ? 'Не удалось безопасно выйти. Попробуйте ещё раз.' : 'Xavfsiz chiqish amalga oshmadi. Qayta urinib ko‘ring.')
    }
  }

  const isPartner = profile?.account_type === 'partner'
  const showPartnerFields = editing ? form?.account_type === 'partner' : isPartner
  const display = editing ? form : profile

  const mainLinks = useMemo(() => [
    { href: '/account', icon: '⌂', uz: 'Kabinet', ru: 'Кабинет' },
    { href: '/listings/new', icon: '+', uz: 'E’lon joylashtirish', ru: 'Разместить объявление' },
    { href: '/account/listings', icon: '▣', uz: 'Mening e’lonlarim', ru: 'Мои объявления' },
    { href: '/account/bookings', icon: '✓', uz: 'Mening bronlarim', ru: 'Мои бронирования' },
    { href: '/account/mortgage', icon: '⌂', uz: 'Ipoteka arizalarim', ru: 'Ипотечные заявки' },
    { href: '/chat', icon: '◌', uz: 'Xabarlar', ru: 'Сообщения' },
    { href: '/account/favorites', icon: '♡', uz: 'Saqlanganlar', ru: 'Избранное' },
    { href: '/account/saved-searches', icon: '⌕', uz: 'Saqlangan qidiruvlar', ru: 'Сохранённые поиски' },
    { href: '/account/referrals', icon: '🎁', uz: 'Do‘stni taklif qilish', ru: 'Пригласить друга' },
  ], [])

  const sellerLinks = useMemo(() => [
    { href: '/account/trusted-profile', icon: '✓', uz: 'Ishonchli profil', ru: 'Надёжный профиль' },
    { href: '/account/monetization', icon: '★', uz: 'E’lonni ilgari surish', ru: 'Продвижение объявления' },
    { href: '/account/company-profile', icon: '▦', uz: 'Firma profili', ru: 'Профиль компании' },
    { href: '/account/wallet', icon: '₿', uz: 'Hisob va to‘lovlar', ru: 'Счёт и платежи' },
    { href: '/realtors/cabinet', icon: '♙', uz: 'Rieltor kabineti', ru: 'Кабинет риелтора' },
  ], [])

  const compactStats = [
    { value: stats.total, label: ru ? 'Barchasi' : 'Barchasi', tone: 'text-emerald-700', bg: 'bg-emerald-50' },
    { value: stats.active, label: ru ? 'Активные' : 'Faol', tone: 'text-green-700', bg: 'bg-green-50' },
    { value: stats.sold, label: ru ? 'Проданные' : 'Sotilgan', tone: 'text-blue-700', bg: 'bg-blue-50' },
    { value: stats.rented, label: ru ? 'Аренда' : 'Ijara', tone: 'text-violet-700', bg: 'bg-violet-50' },
    { value: stats.rejected, label: ru ? 'Отклонены' : 'Rad etilgan', tone: 'text-rose-700', bg: 'bg-rose-50' },
    { value: stats.archived, label: ru ? 'Архив' : 'Arxiv', tone: 'text-slate-700', bg: 'bg-slate-100' },
  ]

  if (loading || !profile || !form || !display) {
    return <main className="min-h-screen bg-[#f4f7f8] p-6"><div className="mx-auto max-w-7xl rounded-[28px] bg-white p-12 text-center shadow-sm">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-slate-950">
      <div className="flex min-h-screen w-full min-w-0">
        <aside className="sticky top-0 hidden h-screen w-[238px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
          <div className="flex h-[78px] items-center border-b border-slate-100 px-5">
            <Link href="/" className="flex items-center gap-2.5"><Image src="/royalhouse-icon.svg" alt="RoyalHouse" width={36} height={36} priority /><span className="text-[17px] font-black">RoyalHouse<span className="text-emerald-600">.uz</span></span></Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">{mainLinks.map((item) => <MenuLink key={item.href} href={item.href} active={item.href === '/account'} icon={item.icon}>{ru ? item.ru : item.uz}</MenuLink>)}</div>
            <div className="my-4 border-t border-slate-100" />
            <div className="space-y-1">{sellerLinks.map((item) => <MenuLink key={item.href} href={item.href} icon={item.icon} onClick={item.href === '/realtors/cabinet' ? openRealtorCabinet : undefined}>{ru ? item.ru : item.uz}</MenuLink>)}</div>
          </nav>
          <div className="border-t border-slate-100 p-3">
            <button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><span>{ru ? 'Язык' : 'Til'}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px]">{ru ? 'O‘z' : 'Ru'}</span></button>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600">↪ {ru ? 'Выйти' : 'Chiqish'}</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 xl:px-8">
              <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden"><Image src="/royalhouse-icon.svg" alt="RoyalHouse" width={34} height={34} priority /><span className="text-[16px] font-black">RoyalHouse<span className="text-emerald-600">.uz</span></span></Link>
              <div className="hidden min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400 md:block">⌕ &nbsp;{ru ? 'Дом, квартира, дача, офис, район...' : 'Uy, kvartira, dacha, ofis, yer...'}</div>
              <div className="ml-auto flex items-center gap-3">
                <button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 lg:hidden">{ru ? 'O‘z' : 'Ru'}</button>
                <div className="hidden items-center gap-2 sm:flex"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{(profile.full_name || 'R').trim().slice(0, 1).toUpperCase()}</div><div className="hidden xl:block"><b className="block max-w-[180px] truncate text-xs font-black">{profile.company_name || profile.full_name || 'RoyalHouse'}</b><small className="text-[10px] text-slate-400">{isPartner ? (ru ? 'Партнёр' : 'Hamkor') : ru ? 'Пользователь' : 'Foydalanuvchi'}</small></div></div>
              </div>
            </div>
          </header>

          <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
            <section className="relative min-h-[245px] overflow-hidden rounded-[28px] border border-emerald-100 bg-[#dff9ee] shadow-sm">
              <Image src="/account-monetization-banner.svg" alt="RoyalHouse monetizatsiya" fill priority className="object-cover" />
              <div className="relative z-10 flex min-h-[245px] max-w-[650px] flex-col justify-center p-7 sm:p-9">
                <span className="w-fit rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{ru ? 'Продвижение объявлений' : 'E’lonni ilgari surish'}</span>
                <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-4xl">{ru ? 'Больше просмотров — быстрее продажа или аренда' : 'Ko‘proq ko‘rishlar — tezroq sotish yoki ijaraga berish'}</h1>
                <p className="mt-2 max-w-[560px] text-sm leading-6 text-slate-600">{ru ? 'Поднимите объявление в результатах поиска и получите больше внимания от покупателей.' : 'E’loningizni qidiruv natijalarida yuqoriga ko‘taring va xaridorlardan ko‘proq e’tibor oling.'}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-white/90 px-3 py-2 text-emerald-800">↗ {ru ? 'Больше показов' : 'Ko‘proq ko‘rsatish'}</span>
                  <span className="rounded-full bg-white/90 px-3 py-2 text-emerald-800">★ TOP / UP / Highlight</span>
                  <span className="rounded-full bg-white/90 px-3 py-2 text-emerald-800">✓ {ru ? 'Контроль результата' : 'Natijani kuzatish'}</span>
                </div>
                <Link href="/account/monetization" className="mt-5 inline-flex w-fit items-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800">{ru ? 'Продвинуть объявление →' : 'E’lonni ilgari surish →'}</Link>
              </div>
            </section>

            <section className="flex flex-col gap-5 rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">{ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{ru ? `Здравствуйте, ${display.full_name || 'пользователь'}! 👋` : `Assalomu alaykum, ${display.full_name || 'foydalanuvchi'}! 👋`}</h2><p className="mt-2 text-sm text-slate-500">{ru ? 'Управляйте объявлениями, бронированиями и профилем в одном месте.' : 'E’lonlar, bronlar va profil sozlamalarini bir joydan boshqaring.'}</p></div>
              <Link href="/listings/new" className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">+ {ru ? 'Разместить объявление' : 'E’lon joylashtirish'}</Link>
            </section>

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}

            <section className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-black">{ru ? 'Статистика объявлений' : 'E’lonlar statistikasi'}</h2><p className="mt-1 text-xs text-slate-500">{ru ? 'Краткий обзор ваших объявлений.' : 'E’lonlaringiz bo‘yicha qisqa ko‘rsatkichlar.'}</p></div><Link href="/account/statistics" className="text-xs font-black text-emerald-700">{ru ? 'Подробнее →' : 'Batafsil →'}</Link></div>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{compactStats.map((item, index) => <div key={`${item.label}-${index}`} className={`flex min-w-0 items-center justify-between gap-2 rounded-2xl px-3 py-3 ${item.bg}`}><span className={`min-w-0 break-words text-[11px] font-bold ${item.tone}`}>{item.label}</span><strong className="text-lg font-black text-slate-950">{item.value}</strong></div>)}</div>
            </section>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-5">
                <section className="w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-black">{ru ? 'Быстрые действия' : 'Tezkor amallar'}</h2><p className="mt-1 text-xs text-slate-500">{ru ? 'Основные действия для продавца.' : 'Sotuvchi uchun asosiy amallar.'}</p></div><Link href="/account/listings" className="text-xs font-black text-emerald-700">{ru ? 'Все объявления →' : 'Barcha e’lonlar →'}</Link></div>
                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/listings/new" className="min-w-0 break-words rounded-2xl bg-emerald-50 p-4 transition hover:bg-emerald-100"><b className="block text-sm font-black text-emerald-800">+ {ru ? 'Новое объявление' : 'Yangi e’lon'}</b><span className="mt-1 block text-xs text-emerald-700/80">{ru ? 'Разместить объект' : 'Obyekt joylashtirish'}</span></Link>
                    <Link href="/account/monetization" className="min-w-0 break-words rounded-2xl bg-amber-50 p-4 transition hover:bg-amber-100"><b className="block text-sm font-black text-amber-800">★ {ru ? 'Продвижение' : 'Ilgari surish'}</b><span className="mt-1 block text-xs text-amber-700/80">{ru ? 'Больше просмотров' : 'Ko‘proq ko‘rishlar'}</span></Link>
                    <Link href="/account/bookings" className="min-w-0 break-words rounded-2xl bg-blue-50 p-4 transition hover:bg-blue-100"><b className="block text-sm font-black text-blue-800">✓ {ru ? 'Бронирования' : 'Bronlar'}</b><span className="mt-1 block text-xs text-blue-700/80">{ru ? 'Контроль заявок' : 'Arizalarni boshqarish'}</span></Link>
                    <Link href="/account/wallet" className="min-w-0 break-words rounded-2xl bg-violet-50 p-4 transition hover:bg-violet-100"><b className="block text-sm font-black text-violet-800">₿ {ru ? 'Счёт и платежи' : 'Hisob va to‘lovlar'}</b><span className="mt-1 block text-xs text-violet-700/80">{ru ? 'Платежи и история' : 'To‘lovlar va tarix'}</span></Link>
                  </div>
                </section>

                <AccountListingsPreview />
              </div>

              <aside className="space-y-4">
                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xl">★</div><div><h2 className="text-base font-black">{ru ? 'Быстрый рост' : 'Tezroq natija'}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Продвиньте активное объявление и отслеживайте показы.' : 'Faol e’lonni ilgari suring va ko‘rishlar natijasini kuzating.'}</p></div></div><Link href="/account/monetization" className="mt-4 block rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-amber-300">{ru ? 'Выбрать продвижение' : 'Ilgari surish tariflarini ko‘rish'}</Link></section>
                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm"><h2 className="text-base font-black">{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{ru ? 'Мы поможем разобраться с сервисами RoyalHouse.' : 'RoyalHouse xizmatlari bo‘yicha yordam beramiz.'}</p><Link href="/chat" className="mt-4 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-black hover:bg-slate-50">{ru ? 'Написать нам' : 'Bizga yozish'}</Link></section>
                <section className="rounded-[26px] border border-sky-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-sm" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M21.7 3.3 2.9 10.55c-1.28.5-1.27 1.2.23 1.5l4.82 1.5 1.85 5.77c.23.65.12.91.8.91.52 0 .75-.24 1.03-.52l2.5-2.43 5.2 3.84c.96.53 1.65.27 1.9-.89l3.42-16.14c.37-1.42-.54-2.06-1.48-1.79ZM8.23 13.17l10.8-6.81c.51-.31.98-.14.6.2l-8.75 7.9-.34 3.63-4.92-1.58-.49.77-.51Z"/></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black">{ru ? 'Подключить Telegram' : 'Telegramni ulash'}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${telegramLinked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{telegramLinked ? (ru ? 'Подключён' : 'Ulangan') : (ru ? 'Не подключён' : 'Ulanmagan')}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{ru ? 'Получайте в @RoyalHouseUz_bot уведомления о новых сообщениях и обращениях по вашим объявлениям, а также важные обновления бронирований и платежей.' : 'E’lonlaringiz bo‘yicha yangi yozishmalar va murojaatlar, shuningdek bron hamda to‘lovlar haqidagi muhim xabarlarni @RoyalHouseUz_bot orqali oling.'}</p>
                      {telegramLinked && telegramUsername && <p className="mt-2 text-xs font-bold text-emerald-700">@{telegramUsername.replace(/^@/, '')}</p>}
                    </div>
                  </div>
                  {telegramError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{telegramError}</p>}
                  {telegramLinked ? (
                    <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold leading-5 text-emerald-800">{ru ? 'Telegram успешно подключён. Уведомления будут приходить в бот.' : 'Telegram muvaffaqiyatli ulangan. Bildirishnomalar botga yuboriladi.'}</div>
                  ) : telegramLinkUrl ? (
                    <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#168AC0]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M21.7 3.3 2.9 10.55c-1.28.5-1.27 1.2.23 1.5l4.82 1.5 1.85 5.77c.23.65.12.91.8.91.52 0 .75-.24 1.03-.52l2.5-2.43 5.2 3.84c.96.53 1.65.27 1.9-.89l3.42-16.14c.37-1.42-.54-2.06-1.48-1.79ZM8.23 13.17l10.8-6.81c.51-.31.98-.14.6.2l-8.75 7.9-.34 3.63-4.92-1.58-.49.77-.51Z"/></svg>
                      {ru ? 'Открыть бота и завершить подключение' : 'Botni ochish va ulashni yakunlash'}
                    </a>
                  ) : (
                    <button type="button" onClick={createTelegramLink} disabled={telegramBusy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-black text-white transition hover:bg-[#168AC0] disabled:cursor-not-allowed disabled:opacity-60">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M21.7 3.3 2.9 10.55c-1.28.5-1.27 1.2.23 1.5l4.82 1.5 1.85 5.77c.23.65.12.91.8.91.52 0 .75-.24 1.03-.52l2.5-2.43 5.2 3.84c.96.53 1.65.27 1.9-.89l3.42-16.14c.37-1.42-.54-2.06-1.48-1.79ZM8.23 13.17l10.8-6.81c.51-.31.98-.14.6.2l-8.75 7.9-.34 3.63-4.92-1.58-.49.77-.51Z"/></svg>
                      {telegramBusy ? (ru ? 'Создаём ссылку…' : 'Havola yaratilmoqda…') : (ru ? 'Подключить Telegram' : 'Telegramni ulash')}
                    </button>
                  )}
                  {!telegramLinked && <p className="mt-2 text-[11px] leading-4 text-slate-400">{ru ? 'Для подтверждения откройте бота и отправьте свой контакт. Номер должен совпадать с номером в профиле RoyalHouse.' : 'Tasdiqlash uchun botni ochib, o‘z telefon raqamingizni yuboring. Raqam RoyalHouse profilingizdagi raqam bilan bir xil bo‘lishi kerak.'}</p>}
                </section>
              </aside>
            </div>
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <Link href="/" className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="text-xl">⌂</span>{ru ? 'Главная' : 'Bosh sahifa'}</Link>
          <Link href="/search" className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="text-xl">⌕</span>{ru ? 'Поиск' : 'Qidiruv'}</Link>
          <Link href="/listings/new" className="-mt-7 flex flex-col items-center justify-center gap-1 rounded-[28px] bg-emerald-600 text-[11px] font-black text-white shadow-xl shadow-emerald-600/30"><span className="text-2xl">+</span>{ru ? 'Объявление' : 'E’lon'}</Link>
          <Link href="/map" className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-500"><span className="text-xl">⌖</span>{ru ? 'Карта' : 'Xarita'}</Link>
          <Link href="/account" className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-50 text-[11px] font-black text-emerald-700"><span className="text-xl">♙</span>{ru ? 'Профиль' : 'Profil'}</Link>
        </nav>
      </div>
    </main>
  )
}
