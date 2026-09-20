'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'

type NavItem = {
  href: string
  label: string
  className: string
}

export default function AccountNavigation() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [lang, setLang] = useState<Lang>('uz')

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')

    const supabase = createClient()
    let mounted = true
    const loadUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) { if (mounted) setUnreadCount(0); return }
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null)
      if (mounted) setUnreadCount(error ? 0 : (count ?? 0))
    }
    void loadUnread()
    const channel = supabase.channel(`account-notifications-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => { const row = payload.new as { user_id?: string; read_at?: string | null }; if (row.user_id && row.read_at == null) void loadUnread() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => { const row = payload.new as { user_id?: string }; if (row.user_id) void loadUnread() })
      .subscribe()
    const onFocus = () => { void loadUnread() }
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; window.removeEventListener('focus', onFocus); void supabase.removeChannel(channel) }
  }, [])

  const toggleLanguage = () => {
    const next: Lang = lang === 'uz' ? 'ru' : 'uz'
    setLang(next)
    window.localStorage.setItem('prohouse-lang', next)
    window.dispatchEvent(new CustomEvent('prohouse-language-change', { detail: next }))
  }

  const ru = lang === 'ru'
  const text = {
    cabinet: ru ? 'Кабинет' : 'Kabinet',
    favorites: ru ? '♡ Избранное' : '♡ Saqlanganlar',
    savedSearches: ru ? '⌕ Сохранённые поиски' : '⌕ Saqlangan qidiruvlar',
    addListing: ru ? '+ Разместить объявление' : '+ E’lon joylashtirish',
    myListings: ru ? 'Мои объявления' : 'Mening e’lonlarim',
    messages: ru ? '💬 Сообщения' : '💬 Xabarlar',
    trusted: ru ? '✓ Надёжный профиль' : '✓ Ishonchli profil',
    promotion: ru ? '★ Продвижение объявления' : '★ E’lonni ilgari surish',
    wallet: ru ? 'Счёт и платежи' : 'Hisob va to‘lovlar',
    unread: ru ? `${unreadCount} непрочитанных сообщений` : `${unreadCount} ta o‘qilmagan xabar`,
    switchLanguage: ru ? 'Ru / O‘z' : 'O‘z / Ru',
    primary: ru ? 'Основное' : 'Asosiy',
    search: ru ? 'Поиск' : 'Qidiruv',
    seller: ru ? 'Продавец' : 'Sotuvchi',
  }

  const primaryItems: NavItem[] = [
    { href: '/account/listings', label: text.myListings, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/listings/new', label: text.addListing, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/chat', label: text.messages, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/favorites', label: text.favorites, className: 'bg-rose-50 text-rose-700' },
  ]

  const sellerItems: NavItem[] = [
    { href: '/account/trusted-profile', label: text.trusted, className: 'bg-emerald-50 text-emerald-700' },
    { href: '/account/monetization', label: text.promotion, className: 'bg-amber-50 text-amber-700' },
    { href: '/account/wallet', label: text.wallet, className: 'bg-emerald-50 text-emerald-700' },
  ]

  return (
    <nav className="border-b border-slate-100 bg-white px-4 py-3">
      <div className="mx-auto max-w-5xl">
        <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
          <Link href="/account" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{text.cabinet}</Link>
          {primaryItems.map(item => <Link key={item.href} href={item.href} className={`rounded-xl px-4 py-2 text-sm font-extrabold hover:brightness-95 ${item.className}`}>{item.label}</Link>)}
          <Link href="/account/saved-searches" className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-100">{text.savedSearches}</Link>
          {sellerItems.map(item => <Link key={item.href} href={item.href} className={`rounded-xl px-4 py-2 text-sm font-extrabold hover:brightness-95 ${item.className}`}>{item.label}</Link>)}
          <button type="button" onClick={toggleLanguage} aria-label={ru ? 'Переключить язык на узбекский' : 'Tilni rus tiliga o‘zgartirish'} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50">{text.switchLanguage}</button>
        </div>

        <div className="md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/account" className="text-lg font-black text-slate-900">{text.cabinet}</Link>
            <button type="button" onClick={toggleLanguage} aria-label={ru ? 'Переключить язык на узбекский' : 'Tilni rus tiliga o‘zgartirish'} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">{text.switchLanguage}</button>
          </div>

          <section className="mb-3" aria-labelledby="account-primary-navigation">
            <h2 id="account-primary-navigation" className="mb-2 px-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{text.primary}</h2>
            <div className="grid grid-cols-2 gap-2">
              {primaryItems.map(item => <Link key={item.href} href={item.href} className={`rounded-xl px-3 py-3 text-center text-xs font-black ${item.className}`}>{item.label}</Link>)}
            </div>
          </section>

          <section className="mb-3" aria-labelledby="account-search-navigation">
            <h2 id="account-search-navigation" className="mb-2 px-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{text.search}</h2>
            <Link href="/account/saved-searches" className="block rounded-xl bg-blue-50 px-3 py-3 text-center text-xs font-black text-blue-700">{text.savedSearches}</Link>
          </section>

          <section aria-labelledby="account-seller-navigation">
            <h2 id="account-seller-navigation" className="mb-2 px-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{text.seller}</h2>
            <div className="grid grid-cols-2 gap-2">
              {sellerItems.map((item, index) => <Link key={item.href} href={item.href} className={`rounded-xl px-3 py-3 text-center text-xs font-black ${index === sellerItems.length - 1 ? 'col-span-2' : ''} ${item.className}`}>{item.label}</Link>)}
            </div>
          </section>
        </div>
      </div>
    </nav>
  )
}
