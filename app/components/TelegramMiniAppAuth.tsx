'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

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
 * Authenticate the Telegram Mini App without blocking the UI.
 * A fresh user is auto-registered. If a different RoyalHouse account is
 * already authenticated in the browser, do not silently switch accounts;
 * surface a mismatch so the user can explicitly link Telegram.
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

        const data = await response.json().catch(() => null)

        if (response.status === 409 && data?.error === 'TELEGRAM_ACCOUNT_MISMATCH') {
          if (!cancelled) {
            window.localStorage.setItem('rh_telegram_mismatch', '1')
            window.dispatchEvent(new CustomEvent('royalhouse:telegram-mismatch'))
          }
          return
        }

        if (cancelled || !response.ok) {
          console.warn('[telegram-miniapp-auth] server auth failed', data?.error || response.status)
          return
        }

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          console.warn('[telegram-miniapp-auth] server returned no session')
          return
        }

        const supabase = createClient()
        const { error } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (error) {
          console.error('[telegram-miniapp-auth] setSession failed', error)
          return
        }

        window.localStorage.removeItem('rh_telegram_mismatch')
        if (cancelled) return
        router.refresh()
      } catch (error) {
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
