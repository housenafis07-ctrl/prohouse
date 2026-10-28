'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
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
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
      {children}
    </span>
  )
}

function MenuLink({
  href,
  active,
  icon,
  children,
}: {
  href: string
  active?: boolean
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
      }`}
    >
      <Icon>{icon}</Icon>
      <span className="truncate">{children}</span>
    </Link>
  )
}

function ProfileField({
  label,
  value,
  form,
  field,
  editing,
  required = false,
  disabled = false,
  onChange,
}: {
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
      <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </label>
      {editing && !disabled ? (
        <input
          value={String(form[field] ?? '')}
          onChange={(event) => onChange(field, event.target.value)}
          required={required}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
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
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    moderation: 0,
    rejected: 0,
    sold: 0,
    rented: 0,
    archived: 0,
  })
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
      // Status polling is deliberately silent.
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
      // Keep the previous values when the network is temporarily unavailable.
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/register')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(
          'phone,full_name,account_type,partner_type,company_name,inn,bank_name,bank_account,mfo,oked,director_full_name',
        )
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (profileError) {
        setError(ru ? 'Не удалось загрузить профиль.' : 'Profilni yuklab bo‘lmadi.')
        setLoading(false)
        return
      }

      if (!data) {
        router.replace('/register?next=%2Faccount')
        return
      }

      setProfile(data as Profile)
      setForm(data as Profile)

      const { data: completeness } = await supabase.rpc('get_seller_profile_completeness')
      if (typeof completeness?.completion_percent === 'number') {
        setCompletion(completeness.completion_percent)
      }

      await Promise.all([loadStats(), loadTelegramStatus()])
      if (mounted) setLoading(false)
    }

    void load()
    return () => {
      mounted = false
    }
  }, [router, ru, loadStats, loadTelegramStatus])

  // Telegram linking is completed by the bot after the user presses /start.
  // Poll briefly so the dashboard changes to "connected" without a page refresh.
  useEffect(() => {
    if (telegramLinked) return
    const interval = window.setInterval(() => {
      void loadTelegramStatus()
    }, 3000)
    return () => window.clearInterval(interval)
  }, [telegramLinked, loadTelegramStatus])

  const setField = (key: keyof Profile, value: string) => {
    setForm((current) => (current ? { ...current, [key]: value } : current))
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
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(
          result.error ||
            (ru ? 'Не удалось сохранить профиль.' : 'Profilni saqlashda xatolik.'),
        )
      }

      setProfile(result.profile as Profile)
      setForm(result.profile as Profile)
      setEditing(false)
      setSuccess(ru ? 'Данные профиля сохранены.' : 'Profil ma’lumotlari saqlandi.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : ru
            ? 'Ошибка сохранения.'
            : 'Saqlashda xatolik.',
      )
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
      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            (ru ? 'Не удалось создать ссылку.' : 'Ulash havolasini yaratib bo‘lmadi.'),
        )
      }
      setTelegramLinkUrl(data.url)
    } catch (linkError) {
      setTelegramError(
        linkError instanceof Error
          ? linkError.message
          : ru
            ? 'Ошибка Telegram.'
            : 'Telegram xatosi.',
      )
    } finally {
      setTelegramBusy(false)
    }
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  const isPartner = profile?.account_type === 'partner'
  const showPartnerFields = editing ? form?.account_type === 'partner' : isPartner
  const display = editing ? form : profile

  const mainLinks = useMemo(
    () => [
      { href: '/account', icon: '⌂', uz: 'Kabinet', ru: 'Кабинет' },
      { href: '/listings/new', icon: '+', uz: 'E’lon joylashtirish', ru: 'Разместить объявление' },
      { href: '/account/listings', icon: '▣', uz: 'Mening e’lonlarim', ru: 'Мои объявления' },
      { href: '/account/bookings', icon: '✓', uz: 'Mening bronlarim', ru: 'Мои бронирования' },
      { href: '/account/mortgage', icon: '⌂', uz: 'Ipoteka arizalarim', ru: 'Ипотечные заявки' },
      { href: '/chat', icon: '◌', uz: 'Xabarlar', ru: 'Сообщения' },
      { href: '/account/favorites', icon: '♡', uz: 'Saqlanganlar', ru: 'Избранное' },
      { href: '/account/saved-searches', icon: '⌕', uz: 'Saqlangan qidiruvlar', ru: 'Сохранённые поиски' },
    ],
    [],
  )

  const sellerLinks = useMemo(
    () => [
      { href: '/account/trusted-profile', icon: '✓', uz: 'Ishonchli profil', ru: 'Надёжный профиль' },
      { href: '/account/monetization', icon: '★', uz: 'E’lonni ilgari surish', ru: 'Продвижение объявления' },
      ...(isPartner
        ? [{ href: '/account/company-profile', icon: '▦', uz: 'Firma profili', ru: 'Профиль компании' }]
        : []),
      { href: '/account/wallet', icon: '₿', uz: 'Hisob va to‘lovlar', ru: 'Счёт и платежи' },
    ],
    [isPartner],
  )

  const cards = [
    { key: 'total', value: stats.total, icon: '▣', label: ru ? 'Все объявления' : 'Barcha e’lonlar', tone: 'bg-emerald-50 text-emerald-700' },
    { key: 'active', value: stats.active, icon: '●', label: ru ? 'Активные' : 'Faol e’lonlar', tone: 'bg-green-50 text-green-700' },
    { key: 'rejected', value: stats.rejected, icon: '×', label: ru ? 'Отклонённые' : 'Rad etilgan', tone: 'bg-rose-50 text-rose-600' },
    { key: 'sold', value: stats.sold, icon: '✓', label: ru ? 'Проданные' : 'Sotilgan', tone: 'bg-blue-50 text-blue-600' },
    { key: 'rented', value: stats.rented, icon: '⌂', label: ru ? 'Сданы в аренду' : 'Ijaraga berilgan', tone: 'bg-violet-50 text-violet-600' },
    { key: 'archived', value: stats.archived, icon: '▤', label: ru ? 'Архив' : 'Arxiv', tone: 'bg-slate-100 text-slate-600' },
  ]

  if (loading || !profile || !form || !display) {
    return (
      <main className="min-h-screen bg-[#f4f7f8] p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] bg-white p-12 text-center shadow-sm">
          {ru ? 'Загрузка...' : 'Yuklanmoqda...'}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[238px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
          <div className="flex h-[78px] items-center border-b border-slate-100 px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/royalhouse-icon.svg" alt="RoyalHouse" width={36} height={36} priority />
              <span className="text-[17px] font-black">RoyalHouse<span className="text-emerald-600">.uz</span></span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {mainLinks.map((item) => (
                <MenuLink key={item.href} href={item.href} active={item.href === '/account'} icon={item.icon}>
                  {ru ? item.ru : item.uz}
                </MenuLink>
              ))}
            </div>
            <div className="my-4 border-t border-slate-100" />
            <div className="space-y-1">
              {sellerLinks.map((item) => (
                <MenuLink key={item.href} href={item.href} icon={item.icon}>
                  {ru ? item.ru : item.uz}
                </MenuLink>
              ))}
            </div>
          </nav>

          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => setLang(ru ? 'uz' : 'ru')}
              className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <span>{ru ? 'Язык' : 'Til'}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px]">{ru ? 'O‘z' : 'Ru'}</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              ↪ {ru ? 'Выйти' : 'Chiqish'}
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 xl:px-8">
              <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
                <Image src="/royalhouse-icon.svg" alt="RoyalHouse" width={34} height={34} priority />
                <span className="text-[16px] font-black">RoyalHouse<span className="text-emerald-600">.uz</span></span>
              </Link>
              <div className="hidden min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400 md:block">
                ⌕ &nbsp;{ru ? 'Дом, квартира, дача, офис, район...' : 'Uy, kvartira, dacha, ofis, yer...'}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLang(ru ? 'uz' : 'ru')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 lg:hidden"
                >
                  {ru ? 'O‘z' : 'Ru'}
                </button>
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                    {(profile.full_name || 'R').trim().slice(0, 1).toUpperCase()}
                  </div>
                  <div className="hidden xl:block">
                    <b className="block max-w-[180px] truncate text-xs font-black">
                      {profile.company_name || profile.full_name || 'RoyalHouse'}
                    </b>
                    <small className="text-[10px] text-slate-400">
                      {isPartner ? (ru ? 'Партнёр' : 'Hamkor') : ru ? 'Пользователь' : 'Foydalanuvchi'}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 xl:px-8">
            <section className="flex flex-col gap-5 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">
                  {ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  {ru ? `Здравствуйте, ${display.full_name || 'пользователь'}! 👋` : `Assalomu alaykum, ${display.full_name || 'foydalanuvchi'}! 👋`}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {ru ? 'Управляйте объявлениями, бронированиями и профилем в одном месте.' : 'E’lonlar, bronlar va profil sozlamalarini bir joydan boshqaring.'}
                </p>
              </div>
              <Link href="/listings/new" className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
                + {ru ? 'Разместить объявление' : 'E’lon joylashtirish'}
              </Link>
            </section>

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}

            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {cards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${card.tone}`}>{card.icon}</div>
                  <p className="mt-4 text-xs font-bold text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{card.value}</p>
                </div>
              ))}
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black">{ru ? 'Быстрые действия' : 'Tezkor amallar'}</h2>
                      <p className="mt-1 text-xs text-slate-500">{ru ? 'Основные действия для продавца.' : 'Sotuvchi uchun asosiy amallar.'}</p>
                    </div>
                    <Link href="/account/listings" className="text-xs font-black text-emerald-700 hover:underline">{ru ? 'Все объявления →' : 'Barcha e’lonlar →'}</Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/listings/new" className="rounded-2xl bg-emerald-50 p-4 transition hover:bg-emerald-100">
                      <b className="block text-sm font-black text-emerald-800">+ {ru ? 'Новое объявление' : 'Yangi e’lon'}</b>
                      <span className="mt-1 block text-xs text-emerald-700/80">{ru ? 'Разместить объект' : 'Obyekt joylashtirish'}</span>
                    </Link>
                    <Link href="/account/monetization" className="rounded-2xl bg-amber-50 p-4 transition hover:bg-amber-100">
                      <b className="block text-sm font-black text-amber-800">★ {ru ? 'Продвижение' : 'Ilgari surish'}</b>
                      <span className="mt-1 block text-xs text-amber-700/80">{ru ? 'Больше просмотров' : 'Ko‘proq ko‘rishlar'}</span>
                    </Link>
                    <Link href="/account/bookings" className="rounded-2xl bg-blue-50 p-4 transition hover:bg-blue-100">
                      <b className="block text-sm font-black text-blue-800">✓ {ru ? 'Бронирования' : 'Bronlar'}</b>
                      <span className="mt-1 block text-xs text-blue-700/80">{ru ? 'Контроль заявок' : 'Arizalarni boshqarish'}</span>
                    </Link>
                    <Link href="/account/wallet" className="rounded-2xl bg-violet-50 p-4 transition hover:bg-violet-100">
                      <b className="block text-sm font-black text-violet-800">₿ {ru ? 'Счёт и платежи' : 'Hisob va to‘lovlar'}</b>
                      <span className="mt-1 block text-xs text-violet-700/80">{ru ? 'Платежи и история' : 'To‘lovlar va tarix'}</span>
                    </Link>
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black">{ru ? 'Профиль' : 'Profil'}</h2>
                      <p className="mt-1 text-xs text-slate-500">{ru ? 'Проверьте и обновите данные.' : 'Ma’lumotlarni tekshiring va yangilang.'}</p>
                    </div>
                    {!editing && <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black hover:bg-slate-50">{ru ? 'Изменить' : 'Tahrirlash'}</button>}
                  </div>

                  <form onSubmit={saveProfile} className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ProfileField label={ru ? 'Ф.И.О.' : 'F.I.O.'} value={display.full_name} form={form} field="full_name" editing={editing} required onChange={setField} />
                      <ProfileField label={ru ? 'Телефон' : 'Telefon'} value={display.phone} form={form} field="phone" editing={false} disabled onChange={setField} />
                      <ProfileField label={ru ? 'Тип аккаунта' : 'Akkaunt turi'} value={display.account_type === 'partner' ? (ru ? 'Партнёр' : 'Hamkor') : ru ? 'Физическое лицо' : 'Jismoniy shaxs'} form={form} field="account_type" editing={false} disabled onChange={setField} />
                      {showPartnerFields && <>
                        <ProfileField label="ИНН" value={display.inn} form={form} field="inn" editing={editing} required onChange={setField} />
                        <ProfileField label={ru ? 'Компания' : 'Firma nomi'} value={display.company_name} form={form} field="company_name" editing={editing} onChange={setField} />
                        <ProfileField label={ru ? 'Банк' : 'Bank'} value={display.bank_name} form={form} field="bank_name" editing={editing} onChange={setField} />
                        <ProfileField label={ru ? 'Расчётный счёт' : 'Hisob raqami'} value={display.bank_account} form={form} field="bank_account" editing={editing} onChange={setField} />
                      </>}
                    </div>
                    {editing && <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setForm(profile); setEditing(false); setError('') }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">{ru ? 'Отмена' : 'Bekor qilish'}</button><button disabled={saving} type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? (ru ? 'Сохранение...' : 'Saqlanmoqda...') : (ru ? 'Сохранить' : 'Saqlash')}</button></div>}
                  </form>
                </section>
              </div>

              <aside className="space-y-5">
                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black">{ru ? 'Статус профиля' : 'Profil holati'}</h2>
                      <p className="mt-1 text-xs text-slate-500">{completion}%</p>
                    </div>
                    <span className="text-sm font-black text-emerald-700">{completion}%</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, completion))}%` }} /></div>
                  <div className="mt-4 space-y-2 text-xs font-bold">
                    <div className="flex items-center justify-between"><span>{ru ? 'Телефон' : 'Telefon raqam'}</span><span className="text-emerald-600">✓</span></div>
                    <div className="flex items-center justify-between"><span>{ru ? 'Основные данные' : 'Asosiy ma’lumotlar'}</span><span className="text-emerald-600">✓</span></div>
                    <div className="flex items-center justify-between"><span>{ru ? 'Социальные сети' : 'Ijtimoiy tarmoqlar'}</span><span className="text-slate-300">○</span></div>
                  </div>
                </section>

                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-xl">✈️</div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-black">Telegram</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{ru ? 'Брони, авансы и отмены будут приходить прямо в бот.' : 'Yangi bronlar, avanslar va bekor qilishlar to‘g‘ridan-to‘g‘ri botga keladi.'}</p>
                    </div>
                  </div>

                  {telegramLinked ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-emerald-800">✓ {ru ? 'Telegram подключён' : 'Telegram ulangan'}</div>
                      {telegramUsername && <p className="mt-1 text-xs font-semibold text-emerald-700">@{telegramUsername.replace(/^@/, '')}</p>}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs font-black text-amber-700">{ru ? 'Telegram не подключён' : 'Telegram ulanmagan'}</p>
                      <button type="button" onClick={createTelegramLink} disabled={telegramBusy} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60">{telegramBusy ? (ru ? 'Создание ссылки...' : 'Havola tayyorlanmoqda...') : (ru ? 'Подключить Telegram' : 'Telegramni ulash')}</button>
                      {telegramLinkUrl && <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">{ru ? 'Открыть Telegram' : 'Telegramni ochish'}</a>}
                      {telegramError && <p className="mt-3 text-xs font-semibold text-rose-600">{telegramError}</p>}
                    </div>
                  )}
                </section>

                <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-black">{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{ru ? 'Мы поможем разобраться с сервисами RoyalHouse.' : 'RoyalHouse xizmatlari bo‘yicha yordam beramiz.'}</p>
                  <Link href="/chat" className="mt-4 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-black hover:bg-slate-50">{ru ? 'Написать нам' : 'Bizga yozish'}</Link>
                </section>
              </aside>
            </div>
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t border-slate-200 bg-white/95 px-2 backdrop-blur lg:hidden">
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
