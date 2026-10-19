'use client'

import { usePathname } from 'next/navigation'

export default function TelegramLoginButton() {
  const pathname = usePathname()
  if (pathname !== '/register') return null

  return (
    <div className="mt-5">
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-slate-200" />
        <span className="relative bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          yoki
        </span>
      </div>
      <a
        href="https://t.me/RoyalHouseUz_bot?startapp=login"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5 font-bold text-sky-700 transition hover:bg-sky-100"
      >
        <span aria-hidden="true">✈️</span>
        Telegram orqali kirish
      </a>
      <p className="mt-2 text-center text-xs text-slate-400">
        Telegram ichida RoyalHouse avtomatik ochiladi.
      </p>
    </div>
  )
}
