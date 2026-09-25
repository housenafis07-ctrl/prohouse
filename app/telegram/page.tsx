'use client'

import Script from 'next/script'
import { FormEvent, useEffect, useState } from 'react'

type Lang = 'uz' | 'ru'

const copy = {
  uz: {
    welcome: 'Xush kelibsiz!',
    subtitle: 'Dacha topish va joylashtirishning qulay usuli',
    ownerTitle: 'Dachamni ijaraga bermoqchiman',
    ownerText: "E'loningizni joylashtiring, mijozlardan buyurtmalar qabul qiling va daromadingizni oshiring.",
    ownerButton: 'Dacha joylashtirish',
    searchTitle: 'Dacha qidirmoqchiman',
    searchText: 'Narx, sana va hudud bo‘yicha mos dachani bir necha daqiqada toping.',
    searchButton: 'Dachalarni ko‘rish',
    keywordPlaceholder: 'Dacha, hovuz, Bo‘stonliq...',
    keywordSearch: 'Qidirish',
    connected: 'Telegram orqali xavfsiz ulangan',
    app: 'Royalhouse Mini App',
  },
  ru: {
    welcome: 'Добро пожаловать!',
    subtitle: 'Удобный способ найти или разместить дачу',
    ownerTitle: 'Хочу сдать дачу в аренду',
    ownerText: 'Разместите объявление, принимайте заявки от клиентов и увеличивайте свой доход.',
    ownerButton: 'Разместить дачу',
    searchTitle: 'Хочу найти дачу',
    searchText: 'Найдите подходящую дачу по цене, дате и району за несколько минут.',
    searchButton: 'Посмотреть дачи',
    keywordPlaceholder: 'Дача, бассейн, Бостанлык...',
    keywordSearch: 'Найти',
    connected: 'Безопасное подключение через Telegram',
    app: 'Royalhouse Mini App',
  },
}

export default function TelegramMiniApp() {
  const [ready, setReady] = useState(false)
  const [lang, setLang] = useState<Lang>('uz')
  const [keyword, setKeyword] = useState('')
  const t = copy[lang]

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return
    tg.ready()
    tg.expand()
    setReady(true)
  }, [])

  const openPath = (path: string) => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) tg.openLink(`${window.location.origin}${path}`)
    else window.location.href = path
  }

  const search = (event: FormEvent) => {
    event.preventDefault()
    const value = keyword.trim()
    const params = new URLSearchParams({ tab: 'all', taxonomy: 'rent_dacha' })
    if (value) params.set('q', value)
    openPath(`/listings?${params.toString()}`)
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <main className="min-h-screen bg-gradient-to-b from-[#4b86c8] to-[#eef5fb] text-slate-900">
        <section className="relative min-h-screen overflow-hidden px-4 pb-8 pt-7">
          <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -left-24 top-24 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative mx-auto max-w-md">
            <div className="text-center text-xs font-semibold text-white/80">ROYALHOUSE</div>
            <div className="mt-5 rounded-[28px] bg-white px-5 pb-7 pt-6 shadow-xl">
              <div className="mx-auto flex h-16 w-fit items-center rounded-2xl bg-white px-5 shadow-md ring-1 ring-slate-100">
                <img src="/royalhouse-icon.svg" alt="Royalhouse" className="mr-3 h-11 w-11 rounded-xl" />
                <div className="text-2xl font-black tracking-tight text-slate-500">Royal<span className="text-emerald-500">house</span></div>
              </div>

              <div className="mt-8 text-center">
                <h1 className="text-[26px] font-black tracking-tight">{t.welcome}</h1>
                <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
              </div>

              <form onSubmit={search} className="mt-6 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t.keywordPlaceholder}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-medium outline-none placeholder:text-slate-400"
                  aria-label={t.keywordPlaceholder}
                />
                <button type="submit" className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white">
                  {t.keywordSearch}
                </button>
              </form>

              <div className="mt-7 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white">⌂</div>
                    <div>
                      <h2 className="font-bold">{t.ownerTitle}</h2>
                      <p className="mt-1 text-xs leading-4 text-slate-400">{t.ownerText}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openPath('/listings/new')} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-white">{t.ownerButton}</button>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-2xl text-white">⌕</div>
                    <div>
                      <h2 className="font-bold">{t.searchTitle}</h2>
                      <p className="mt-1 text-xs leading-4 text-slate-400">{t.searchText}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openPath('/listings?tab=all&taxonomy=rent_dacha')} className="mt-4 w-full rounded-2xl bg-blue-500 py-3.5 text-sm font-black text-white">{t.searchButton}</button>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold">
                <button type="button" onClick={() => setLang('uz')} aria-pressed={lang === 'uz'} className={`rounded-full px-4 py-2 transition ${lang === 'uz' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>UZ</button>
                <button type="button" onClick={() => setLang('ru')} aria-pressed={lang === 'ru'} className={`rounded-full px-4 py-2 transition ${lang === 'ru' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>RU</button>
              </div>
              <p className="mt-5 text-center text-[10px] text-slate-300">{ready ? t.connected : t.app}</p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
