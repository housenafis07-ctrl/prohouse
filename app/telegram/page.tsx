'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

export default function TelegramMiniApp() {
  const [ready, setReady] = useState(false)

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
                <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-2xl text-white">⌂</div>
                <div className="text-2xl font-black tracking-tight text-slate-500">Royal<span className="text-emerald-500">house</span></div>
              </div>
              <div className="mt-8 text-center">
                <h1 className="text-[26px] font-black tracking-tight">Xush kelibsiz!</h1>
                <p className="mt-1 text-sm text-slate-400">Dacha topish va joylashtirishning qulay usuli</p>
              </div>
              <div className="mt-7 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white">⌂</div>
                    <div>
                      <h2 className="font-bold">Dachamni ijaraga bermoqchiman</h2>
                      <p className="mt-1 text-xs leading-4 text-slate-400">E&apos;loningizni joylashtiring, mijozlardan buyurtmalar qabul qiling va daromadingizni oshiring.</p>
                    </div>
                  </div>
                  <button onClick={() => openPath('/listings/new')} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-white">Dacha joylashtirish</button>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-2xl text-white">⌕</div>
                    <div>
                      <h2 className="font-bold">Dacha qidirmoqchiman</h2>
                      <p className="mt-1 text-xs leading-4 text-slate-400">Narx, sana va hudud bo&apos;yicha mos dachani bir necha daqiqada toping.</p>
                    </div>
                  </div>
                  <button onClick={() => openPath('/listings?tab=daily')} className="mt-4 w-full rounded-2xl bg-blue-500 py-3.5 text-sm font-black text-white">Dachalarni ko&apos;rish</button>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-blue-500 px-4 py-2 text-white">UZ</span>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-400">RU</span>
              </div>
              <p className="mt-5 text-center text-[10px] text-slate-300">{ready ? 'Telegram orqali xavfsiz ulangan' : 'Royalhouse Mini App'}</p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
