'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

export default function MobileAccountMenu() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const [companyProfileEnabled, setCompanyProfileEnabled] = useState(false)
  const [profile, setProfile] = useState<{full_name:string|null;phone:string|null;account_type:string|null;email:string|null;instagram_url:string|null;facebook_url:string|null;linkedin_url:string|null;telegram_url:string|null;company_name:string|null}|null>(null)
  const ru = lang === 'ru'

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const response = await fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (mounted && response.ok && data.profile) setProfile(data.profile)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: plan } = await supabase.rpc('get_active_partner_plan', { p_user_id: user.id })
      if (mounted) setCompanyProfileEnabled(Boolean(Array.isArray(plan) && plan[0]?.company_profile))
    }
    void load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [open])

  const items = [
    { href: '/account/favorites', label: ru ? '❤️ Избранное' : '❤️ Saqlanganlar' },
    { href: '/account/saved-searches', label: ru ? '🔍 Сохранённые поиски' : '🔍 Saqlangan qidiruvlar' },
    { href: '/account/bookings', label: ru ? '📑 Мои бронирования' : '📑 Mening bronlarim' },
    { href: '/account/mortgage', label: ru ? '🏠 Ипотечные заявки' : '🏠 Ipoteka arizalarim' },
    { href: '/chat', label: ru ? '🔔 Сообщения' : '🔔 Xabarlar' },
    { href: '/account/trusted-profile', label: ru ? '🛡️ Надёжный профиль' : '🛡️ Ishonchli profil' },
    { href: '/account/monetization', label: ru ? '⭐ Продвижение объявления' : '⭐ E’lonni ilgari surish' },
    ...(companyProfileEnabled ? [{ href: '/account/company-profile', label: ru ? '🏢 Профиль компании' : '🏢 Firma profili' }] : []),
    { href: '/account/wallet', label: ru ? '💳 Счёт и платежи' : '💳 Hisob va to‘lovlar' },
  ]

  const close = () => setOpen(false)

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="pointer-events-none fixed right-3 top-[72px] z-[100] md:hidden">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="mobile-account-drawer" aria-label={open ? (ru ? 'Закрыть меню' : 'Menyuni yopish') : (ru ? 'Открыть меню' : 'Menyuni ochish')} className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[22px] font-black leading-none text-slate-900 shadow-lg">{open ? '×' : '☰'}</button>
      {open && <div className="pointer-events-auto fixed inset-0 z-[110]">
        <button type="button" aria-label={ru ? 'Закрыть меню' : 'Menyuni yopish'} onClick={close} className="absolute inset-0 bg-slate-950/35" />
        <aside id="mobile-account-drawer" role="dialog" aria-modal="true" aria-label={ru ? 'Меню кабинета' : 'Kabinet menyusi'} className="absolute right-3 top-[max(84px,env(safe-area-inset-top))] bottom-[calc(88px+env(safe-area-inset-bottom))] flex w-[min(88vw,360px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3"><span className="text-xs font-black uppercase tracking-widest text-slate-400">{ru ? 'Кабинет' : 'Kabinet'}</span><button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700">🌐 {ru ? 'O‘z' : 'Ru'}</button></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-2 pb-3 pt-2 [webkit-overflow-scrolling:touch]">
            <section className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{ru ? 'Профиль и публичные данные' : 'Profil va ochiq ma’lumotlar'}</p>
              {profile ? <><p className="mt-2 text-sm font-black text-slate-900">{profile.company_name || profile.full_name || '—'}</p><div className="mt-2 grid gap-1 text-xs text-slate-600"><p>{ru ? 'Телефон' : 'Telefon'}: <b className="text-slate-800">{profile.phone || '—'}</b></p><p>{ru ? 'Тип аккаунта' : 'Akkaunt turi'}: <b className="text-slate-800">{profile.account_type === 'partner' ? (ru ? 'Партнёр' : 'Hamkor') : (ru ? 'Физическое лицо' : 'Jismoniy shaxs')}</b></p><p>{ru ? 'Эл. почта' : 'Email'}: <b className="text-slate-800">{profile.email || '—'}</b></p>{[profile.instagram_url,profile.facebook_url,profile.linkedin_url,profile.telegram_url].filter(Boolean).length>0 && <p className="break-all">{ru ? 'Соцсети' : 'Ijtimoiy tarmoqlar'}: <b className="text-slate-800">{[profile.instagram_url,profile.facebook_url,profile.linkedin_url,profile.telegram_url].filter(Boolean).join(' · ')}</b></p>}</div></> : <p className="mt-2 text-xs text-slate-500">{ru ? 'Загрузка профиля…' : 'Profil yuklanmoqda…'}</p>}
              <Link href="/account/profile" onClick={close} className="mt-3 block rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-emerald-700 shadow-sm">{ru ? 'Изменить профиль' : 'Profilni tahrirlash'}</Link>
            </section>
            <nav className="grid gap-1" aria-label={ru ? 'Навигация кабинета' : 'Kabinet navigatsiyasi'}>{items.map(item => <Link key={item.href} href={item.href} onClick={close} className="rounded-xl px-3 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 active:bg-slate-100">{item.label}</Link>)}</nav>
            {!companyProfileEnabled && <Link href="/account/monetization" onClick={close} className="mt-2 block rounded-xl bg-violet-50 px-3 py-3 text-sm font-black text-violet-800">🏢 {ru ? 'Business тарифини танлаш' : 'Business tarifini tanlash'}</Link>}
            <div className="mt-1 border-t border-slate-100 pt-1"><Link href="/account" onClick={close} className="block rounded-xl px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">⚙️ {ru ? 'Настройки' : 'Sozlamalar'}</Link><button type="button" onClick={signOut} className="w-full rounded-xl bg-rose-50 px-3 py-3 text-left text-sm font-black text-rose-700">🚪 {ru ? 'Выйти' : 'Chiqish'}</button></div>
          </div>
        </aside>
      </div>}
    </div>
  )
}
