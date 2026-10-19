'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

const TELEGRAM_MAIN_APP_URL = 'https://t.me/RoyalHouseUz_bot?startapp=login'

export default function TelegramLoginButton() {
  const pathname = usePathname()
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (pathname !== '/register') return

    let mounted = true
    const findTarget = () => {
      const phoneInput = document.querySelector<HTMLInputElement>('input[autocomplete="tel"]')
      const form = phoneInput?.closest('form')
      if (!form) return false

      const existing = document.getElementById('royalhouse-telegram-login')
      if (existing) {
        if (mounted) setTarget(existing)
        return true
      }

      const host = document.createElement('div')
      host.id = 'royalhouse-telegram-login'
      form.insertAdjacentElement('afterend', host)
      if (mounted) setTarget(host)
      return true
    }

    if (findTarget()) return () => { mounted = false }

    const observer = new MutationObserver(() => {
      if (findTarget()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      mounted = false
      observer.disconnect()
      document.getElementById('royalhouse-telegram-login')?.remove()
    }
  }, [pathname])

  if (pathname !== '/register' || !target) return null

  const openTelegram = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const webApp = window.Telegram?.WebApp
    if (webApp?.openTelegramLink) {
      event.preventDefault()
      webApp.openTelegramLink(TELEGRAM_MAIN_APP_URL)
    }
  }

  return createPortal(
    <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
      <div className="relative my-1 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-sky-100" />
        <span className="relative bg-sky-50 px-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
          yoki
        </span>
      </div>
      <a
        href={TELEGRAM_MAIN_APP_URL}
        onClick={openTelegram}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3.5 font-bold text-white transition hover:bg-sky-700"
      >
        <span aria-hidden="true">✈️</span>
        Telegram orqali davom etish
      </a>
      <p className="mt-2 text-center text-xs text-sky-700/70">
        Telegram ichida RoyalHouse avtomatik ochiladi va profilga kiritadi.
      </p>
    </div>,
    target,
  )
}
