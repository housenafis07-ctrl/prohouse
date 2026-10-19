'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Telegram Main Mini App authentication is a background enhancement.
 * It must never gate or visually block the RoyalHouse UI.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      // Release Telegram UI immediately. Never wait for our server auth here.
      webApp.ready()
      webApp.expand()

      const controller = new AbortController()
      timer = window.setTimeout(() => controller.abort(), 7000)

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok || cancelled) return

        // Preserve the page the user opened. Refresh only after background auth succeeds.
        router.refresh()
      } catch (error) {
        // Authentication failure must never freeze or redirect the Mini App.
        console.warn('[telegram-miniapp-auth] background authentication skipped', error)
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const start = () => {
      if (cancelled) return true
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return false
      void authenticate(webApp)
      return true
    }

    if (start()) {
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
      }
    }

    const existing = document.querySelector('script[data-telegram-web-app]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', start, { once: true })
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
        existing.removeEventListener('load', start)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.dataset.telegramWebApp = 'true'
    script.onload = start
    document.head.appendChild(script)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      script.onload = null
    }
  }, [router])

  return null
}
