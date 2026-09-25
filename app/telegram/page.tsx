'use client'

import Script from 'next/script'
import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Lang = 'uz' | 'ru'

type NavItem = {
  label: string
  icon: string
  href: string
}

const copy = {
  uz: {
    welcome: 'Royalhouse’ga xush kelibsiz!',
    subtitle: 'Ko‘chmas mulkni toping, soting yoki ijaraga bering.',
    need: 'Sizga nima kerak?',
    findHome: 'Uy / kvartira / hovli topish',
    findHomeText: 'Sotuvdagi uylar, kvartiralar va hovlilarni toping.',
    findDacha: 'Dacha topish',
    findDachaText: 'Dam olish uchun dacha va kunlik ijara e’lonlarini toping.',
    placeAd: 'E’lon joylashtirish',
    placeAdText: 'Mulkni sotish yoki ijaraga berish uchun e’lon yarating.',
    searchPlaceholder: 'Dacha, kvartira, hovli, Toshkent...',
    searchButton: 'Qidirish',
    connected: 'Telegram orqali xavfsiz ulangan',
    app: 'Royalhouse Mini App',
    navHome: 'Bosh sahifa',
    navSearch: 'Qidiruv',
    navAd: 'E’lon',
    navMap: 'Xarita',
    navProfile: 'Profil',
  },
  ru: {
    welcome: 'Добро пожаловать в Royalhouse!',
    subtitle: 'Находите, продавайте и арендуйте недвижимость.',
    need: 'Что вам нужно?',
    findHome: 'Найти дом / квартиру / двор',
    findHomeText: 'Найдите дома, квартиры и участки в продаже.',
    findDacha: 'Найти дачу',
    findDachaText: 'Найдите дачи и объявления посуточной аренды.',
    placeAd: 'Разместить объявление',
    placeAdText: 'Создайте объявление о продаже или аренде недвижимости.',
    searchPlaceholder: 'Дача, квартира, дом, Ташкент...',
    searchButton: 'Найти',
    connected: 'Безопасное подключение через Telegram',
    app: 'Royalhouse Mini App',
    navHome: 'Главная',
    navSearch: 'Поиск',
    navAd: 'Объявление',
    navMap: 'Карта',
    navProfile: 'Профиль',
  },
}

export default function TelegramMiniApp() {
  const [ready, setReady] = useState(false)
  const [lang, setLang] = useState<Lang>(() => typeof window !== 'undefined' && localStorage.getItem('royalhouse-lang') === 'ru' ? 'ru' : 'uz')
  const [keyword, setKeyword] = useState('')
  const t = copy[lang]

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      setReady(true)
    }

    const syncLanguage = () => setLang(localStorage.getItem('royalhouse-lang') === 'ru' ? 'ru' : 'uz')
    window.addEventListener('royalhouse-language-change', syncLanguage)
    window.addEventListener('storage', syncLanguage)
    return () => {
      window.removeEventListener('royalhouse-language-change', syncLanguage)
      window.removeEventListener('storage', syncLanguage)
    }
  }, [])

  const changeLanguage = (next: Lang) => {
    setLang(next)
    localStorage.setItem('royalhouse-lang', next)
    window.dispatchEvent(new Event('royalhouse-language-change'))
  }

  const openPath = (path: string) => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) tg.openLink(`${window.location.origin}${path}`)
    else window.location.href = path
  }

  const openInMiniApp = (path: string) => {
    window.location.href = path
  }

  const handlePlaceAd = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    openInMiniApp(user ? '/listings/new' : '/register?redirect=/listings/new')
  }

  const search = (event: FormEvent) => {
    event.preventDefault()
    const value = keyword.trim()
    const params = new URLSearchParams({ tab: 'all' })
    if (value) params.set('q', value)
    openPath(`/listings?${params.toString()}`)
  }

  const navItems: NavItem[] = [
    { label: t.navHome, icon: '⌂', href: '/telegram' },
    { label: t.navSearch, icon: '⌕', href: '/listings?tab=all' },
    { label: t.navAd, icon: '+', href: '/listings/new' },
    { label: t.navMap, icon: '⌖', href: '/listings/map' },
    { label: t.navProfile, icon: '♙', href: '/account' },
  ]

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <main data-no-global-i18n className="min-h-screen bg-[#f4f7fa] pb-24 text-slate-900">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#4381c5] to-[#eef5fb] px-4 pb-8 pt-7">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -left-24 top-28 h-48 w-48 rounded-full bg-white/10" />

          <div className="relative mx-auto max-w-md">
            <div className="mx-auto flex h-16 w-fit items-center rounded-2xl bg-white px-5 shadow-lg ring-1 ring-white/60">
              <img src="/royalhouse-icon.svg" alt="Royalhouse" className="mr-3 h-11 w-11 rounded-xl" />
              <div className="text-2xl font-black tracking-tight text-slate-700">Royal<span className="text-emerald-500">house</span></div>
            </div>

            <div className="mt-7 text-center text-white">
              <h1 className="text-[27px] font-black tracking-tight">{t.welcome}</h1>
              <p className="mt-1 text-sm text-white/75">{t.subtitle}</p>
            </div>

            <form onSubmit={search} className="mt-6 flex gap-2 rounded-2xl bg-white p-2 shadow-xl">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-medium outline-none placeholder:text-slate-400"
                aria-label={t.searchPlaceholder}
              />
              <button type="submit" className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">
                {t.searchButton}
              </button>
            </form>
          </div>
        </section>

        <section className="mx-auto -mt-1 max-w-md px-4 pt-5">
          <h2 className="mb-4 text-lg font-black">{t.need}</h2>

          <div className="space-y-3">
            <button type="button" onClick={() => openPath('/listings?tab=sale')} className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition active:scale-[.99]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white">⌂</div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{t.findHome}</h3>
                  <p className="mt-1 text-xs leading-4 text-slate-400">{t.findHomeText}</p>
                </div>
                <span className="text-xl text-slate-300">›</span>
              </div>
            </button>

            <button type="button" onClick={() => openPath('/listings?tab=all&taxonomy=rent_dacha')} className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition active:scale-[.99]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-2xl text-white">⌂</div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{t.findDacha}</h3>
                  <p className="mt-1 text-xs leading-4 text-slate-400">{t.findDachaText}</p>
                </div>
                <span className="text-xl text-slate-300">›</span>
              </div>
            </button>

            <button type="button" onClick={handlePlaceAd} className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition active:scale-[.99]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-black text-white">+</div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{t.placeAd}</h3>
                  <p className="mt-1 text-xs leading-4 text-slate-400">{t.placeAdText}</p>
                </div>
                <span className="text-xl text-slate-300">›</span>
              </div>
            </button>
          </div>

          <div className="mt-5 flex justify-center gap-2 text-xs font-bold">
            <button type="button" onClick={() => changeLanguage('uz')} aria-pressed={lang === 'uz'} className={`rounded-full px-4 py-2 transition ${lang === 'uz' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400'}`}>UZ</button>
            <button type="button" onClick={() => changeLanguage('ru')} aria-pressed={lang === 'ru'} className={`rounded-full px-4 py-2 transition ${lang === 'ru' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400'}`}>RU</button>
          </div>

          <p className="mt-4 text-center text-[10px] text-slate-300">{ready ? t.connected : t.app}</p>
        </section>

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {navItems.map((item, index) => (
              <button
                key={item.href}
                type="button"
                onClick={() => openPath(item.href)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[10px] font-bold ${index === 0 ? 'text-blue-500' : 'text-slate-500'}`}
              >
                <span className={`${index === 2 ? 'flex h-11 w-11 -mt-7 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg ring-4 ring-[#f4f7fa]' : 'text-[22px] leading-5'}`}>{item.icon}</span>
                <span className={index === 2 ? 'mt-1' : ''}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </main>
    </>
  )
}
