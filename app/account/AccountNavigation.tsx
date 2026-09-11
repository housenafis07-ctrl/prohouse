'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'

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
    promotion: '★ Promotion',
    wallet: ru ? 'Счёт и транзакции' : 'Hisob va tranzaksiyalar',
    unread: ru ? `${unreadCount} непрочитанных сообщений` : `${unreadCount} ta o‘qilmagan xabar`,
    switchLanguage: ru ? 'Ru / O‘z' : 'O‘z / Ru',
  }

  return (
    <nav className="border-b border-slate-100 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
        <Link href="/account" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{text.cabinet}</Link>
        <Link href="/account/favorites" className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-extrabold text-rose-700 hover:bg-rose-100">{text.favorites}</Link>
        <Link href="/account/saved-searches" className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 hover:bg-blue-100">{text.savedSearches}</Link>
        <Link href="/listings/new" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">{text.addListing}</Link>
        <Link href="/account/listings" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">{text.myListings}</Link>
        <Link href="/chat" className="relative rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">
          <span>{text.messages}</span>
          {unreadCount > 0 && <span aria-label={text.unread} className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black leading-none text-white ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </Link>
        <Link href="/account/trusted-profile" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">{text.trusted}</Link>
        <Link href="/account/monetization" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-extrabold text-amber-700 hover:bg-amber-100">{text.promotion}</Link>
        <Link href="/account/wallet" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">{text.wallet}</Link>
        <button type="button" onClick={toggleLanguage} aria-label={ru ? 'Переключить язык на узбекский' : 'Tilni rus tiliga o‘zgartirish'} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50">{text.switchLanguage}</button>
      </div>
    </nav>
  )
}
