'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type NavItem = { href: string; label: string; className: string }

export default function AccountNavigation() {
  const { lang, setLang } = useI18n()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isPartner, setIsPartner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    const loadAccountState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) { if (mounted) { setUnreadCount(0); setIsPartner(false) }; return }
      const [{ count, error }, { data: profile }] = await Promise.all([
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
        supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
      ])
      if (mounted) {
        setUnreadCount(error ? 0 : (count ?? 0))
        setIsPartner(profile?.account_type === 'partner')
      }
    }
    void loadAccountState()
    const channel = supabase.channel(`account-notifications-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => { const row = payload.new as { user_id?: string; read_at?: string | null }; if (row.user_id && row.read_at == null) void loadAccountState() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => { const row = payload.new as { user_id?: string }; if (row.user_id) void loadAccountState() })
      .subscribe()
    const onFocus = () => { void loadAccountState() }
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; window.removeEventListener('focus', onFocus); void supabase.removeChannel(channel) }
  }, [])

  const ru = lang === 'ru'
  const text = {
    cabinet: ru ? 'Кабинет' : 'Kabinet', favorites: ru ? '♡ Избранное' : '♡ Saqlanganlar',
    savedSearches: ru ? '⌕ Сохранённые поиски' : '⌕ Saqlangan qidiruvlar', mortgage: ru ? '🏠 Ипотечные заявки' : '🏠 Ipoteka arizalarim',
    addListing: ru ? '+ Разместить объявление' : '+ E’lon joylashtirish', myListings: ru ? 'Мои объявления' : 'Mening e’lonlarim',
    bookings: ru ? 'Мои бронирования' : 'Mening bronlarim', messages: ru ? '💬 Сообщения' : '💬 Xabarlar',
    trusted: ru ? '✓ Надёжный профиль' : '✓ Ishonchli profil', promotion: ru ? '★ Продвижение объявления' : '★ E’lonni ilgari surish',
    company: ru ? '🏢 Профиль компании' : '🏢 Firma profili', wallet: ru ? 'Счёт и платежи' : 'Hisob va to‘lovlar',
    settings: ru ? '⚙️ Настройки' : '⚙️ Sozlamalar',
    switchLanguage: ru ? '🌐 Язык' : '🌐 Til', menu: ru ? 'Меню' : 'Menyu',
    close: ru ? 'Закрыть меню' : 'Menyuni yopish', logout: ru ? '🚪 Выйти' : '🚪 Chiqish',
  }
  const toggleLanguage = () => setLang(ru ? 'uz' : 'ru')

  const primaryItems: NavItem[] = [
    { href: '/solishtirish', label: ru ? '⚖️ Сравнение' : '⚖️ Solishtirish', className: 'bg-slate-100 text-slate-700' },
    { href: '/account/listings', label: text.myListings, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/bookings', label: text.bookings, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/mortgage', label: text.mortgage, className: 'bg-amber-50 text-amber-700' },
    { href: '/listings/new', label: text.addListing, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/chat', label: text.messages, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/favorites', label: text.favorites, className: 'bg-rose-50 text-rose-700' },
  ]
  const sellerItems: NavItem[] = [
    { href: '/account/trusted-profile', label: text.trusted, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/monetization', label: text.promotion, className: 'bg-amber-50 text-amber-700' },
    ...(isPartner ? [{ href: '/account/company-profile', label: text.company, className: 'bg-violet-50 text-violet-700' }] : []),
    { href: '/account/wallet', label: text.wallet, className: 'bg-emerald-50 text-emerald-700' },
  ]

  const mobileMenuItems: NavItem[] = [
    { href: '/account/listings', label: text.myListings, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/favorites', label: text.favorites, className: 'bg-rose-50 text-rose-700' },
    { href: '/account/saved-searches', label: text.savedSearches, className: 'bg-blue-50 text-blue-700' },
    { href: '/account/bookings', label: text.bookings, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/mortgage', label: text.mortgage, className: 'bg-amber-50 text-amber-700' },
    { href: '/chat', label: text.messages, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/trusted-profile', label: text.trusted, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/monetization', label: text.promotion, className: 'bg-amber-50 text-amber-700' },
    { href: '/account/company-profile', label: text.company, className: 'bg-violet-50 text-violet-700' },
    { href: '/account/wallet', label: text.wallet, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account', label: text.settings, className: 'bg-slate-100 text-slate-700' },
  ]

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return <nav className="border-b border-slate-100 bg-white px-3 py-2"><div className="mx-auto max-w-6xl">
    <div className="hidden gap-1.5 md:flex md:flex-col"><div className="flex flex-wrap items-center gap-1.5">
      <Link href="/account" className="rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-slate-600 hover:bg-slate-50">{text.cabinet}</Link>
      {primaryItems.map(item => <Link key={item.href} href={item.href} className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold hover:brightness-95 ${item.className}`}>{item.label}</Link>)}
      <Link href="/account/saved-searches" className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-extrabold text-blue-700 hover:bg-blue-100">{text.savedSearches}</Link>
    </div><div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-1.5">
      {sellerItems.map(item => <Link key={item.href} href={item.href} className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold hover:brightness-95 ${item.className}`}>{item.label}</Link>)}
      <button type="button" onClick={toggleLanguage} aria-label={ru ? 'Переключить язык на узбекский' : 'Tilni rus tiliga o‘zgartirish'} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50">{text.switchLanguage}</button>
    </div></div>

    <div className="relative md:hidden">
      <div className="flex items-center justify-between">
        <Link href="/account" className="text-base font-black text-slate-900">{text.cabinet}</Link>
        <button type="button" onClick={() => setMenuOpen(current => !current)} aria-expanded={menuOpen} aria-controls="mobile-account-menu" aria-label={menuOpen ? text.close : text.menu} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-black text-slate-900 shadow-sm">
          {menuOpen ? '×' : '☰'}
        </button>
      </div>

      {menuOpen && <>
        <button type="button" aria-label={text.close} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/10" />
        <div id="mobile-account-menu" className="absolute right-0 top-14 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{text.menu}</span>
            <button type="button" onClick={toggleLanguage} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-black text-slate-700">{text.switchLanguage}</button>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {mobileMenuItems.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`rounded-xl px-3 py-3 text-sm font-black ${item.className}`}>{item.label}</Link>)}
          </div>
          <button type="button" onClick={signOut} className="mt-1 w-full rounded-xl bg-rose-50 px-3 py-3 text-left text-sm font-black text-rose-700">{text.logout}</button>
        </div>
      </>}
    </div>
  </div></nav>
}
