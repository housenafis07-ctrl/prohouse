'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

export default function MobileAccountMenu() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ru = lang === 'ru'

  const items = [
    { href: '/account/listings', label: ru ? '📑 Мои объявления' : '📑 Mening e’lonlarim' },
    { href: '/account/favorites', label: ru ? '❤️ Избранное' : '❤️ Saqlanganlar' },
    { href: '/account/saved-searches', label: ru ? '🔍 Сохранённые поиски' : '🔍 Saqlangan qidiruvlar' },
    { href: '/account/bookings', label: ru ? '📑 Мои бронирования' : '📑 Mening bronlarim' },
    { href: '/account/mortgage', label: ru ? '🏠 Ипотечные заявки' : '🏠 Ipoteka arizalarim' },
    { href: '/chat', label: ru ? '🔔 Сообщения' : '🔔 Xabarlar' },
    { href: '/account/trusted-profile', label: ru ? '🛡️ Надёжный профиль' : '🛡️ Ishonchli profil' },
    { href: '/account/monetization', label: ru ? '⭐ Продвижение объявления' : '⭐ E’lonni ilgari surish' },
    { href: '/account/company-profile', label: ru ? '🏢 Профиль компании' : '🏢 Firma profili' },
    { href: '/account/wallet', label: ru ? '💳 Счёт и платежи' : '💳 Hisob va to‘lovlar' },
  ]

  const close = () => setOpen(false)

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="fixed right-3 top-[72px] z-[100] md:hidden">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="mobile-account-drawer"
        aria-label={open ? (ru ? 'Закрыть меню' : 'Menyuni yopish') : (ru ? 'Открыть меню' : 'Menyuni ochish')}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[22px] font-black leading-none text-slate-900 shadow-lg"
      >
        {open ? '×' : '☰'}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={ru ? 'Закрыть меню' : 'Menyuni yopish'}
            onClick={close}
            className="fixed inset-0 z-40 bg-slate-950/20"
          />
          <aside
            id="mobile-account-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={ru ? 'Меню кабинета' : 'Kabinet menyusi'}
            className="absolute right-0 top-14 z-50 w-[min(88vw,340px)] max-h-[calc(100dvh-150px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">{ru ? 'Кабинет' : 'Kabinet'}</span>
              <button type="button" onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700">
                🌐 {ru ? 'O‘z' : 'Ru'}
              </button>
            </div>

            <nav className="mt-2 grid gap-1" aria-label={ru ? 'Навигация кабинета' : 'Kabinet navigatsiyasi'}>
              {items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="rounded-xl px-3 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 active:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-1 border-t border-slate-100 pt-1">
              <Link href="/account" onClick={close} className="block rounded-xl px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                ⚙️ {ru ? 'Настройки' : 'Sozlamalar'}
              </Link>
              <button type="button" onClick={signOut} className="w-full rounded-xl bg-rose-50 px-3 py-3 text-left text-sm font-black text-rose-700">
                🚪 {ru ? 'Выйти' : 'Chiqish'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
