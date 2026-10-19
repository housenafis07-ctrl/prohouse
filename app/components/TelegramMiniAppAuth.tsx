'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { start_param?: string }
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export async function ensureTelegramSession() {
  const webApp = window.Telegram?.WebApp
  if (!webApp?.initData) return false

  const startParam = webApp.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('tgWebAppStartParam') || ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: webApp.initData, startParam }),
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error || 'Telegram authentication failed')

    webApp.ready()
    webApp.expand()
    return true
  } finally {
    window.clearTimeout(timeout)
  }
}

/**
 * Telegram authentication is intentionally non-blocking.
 *
 * The Mini App itself must always remain usable even if the authentication
 * endpoint is temporarily unavailable. Previously this component rendered a
 * full-screen spinner before the API completed, which made the bot appear
 * completely frozen when server auth failed or timed out.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined
    const startedAt = Date.now()

    const finish = async () => {
      const webApp = window.Telegram?.WebApp
      if (cancelled || !webApp?.initData) return

      try {
        const authenticated = await ensureTelegramSession()
        if (cancelled || !authenticated) return

        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname

        if (target !== pathname) {
          router.replace(target || '/')
          return
        }

        router.refresh()
      } catch (error) {
        // Never block the Mini App because Telegram auth failed.
        console.error('[telegram-miniapp-auth]', error)
      }
    }

    const tryStart = () => {
      const webApp = window.Telegram?.WebApp
      if (webApp?.initData) {
        void finish()
        return true
      }
      if (Date.now() - startedAt >= 8000) return true
      timer = window.setTimeout(tryStart, 100)
      return false
    }

    tryStart()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [pathname, router])

  return null
}
