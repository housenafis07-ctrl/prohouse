'use client'

import { useEffect, useRef } from 'react'
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
 * Telegram authentication is strictly background-only.
 * The Mini App must render and remain usable even when auth/network is slow
 * or unavailable. We also avoid loading Telegram's SDK on ordinary web visits.
 */
export default function TelegramMiniAppAuth() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      // Release the Mini App immediately. Nothing below is allowed to gate UI.
      webApp.ready()
      webApp.expand()

      const controller = new AbortController()
      timer = window.setTimeout(() => controller.abort(), 4000)

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
        if (cancelled || !response.ok) {
          console.warn('[telegram-miniapp-auth] background auth failed', data?.error || response.status)
          return
        }

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          console.warn('[telegram-miniapp-auth] background auth returned no session')
          return
        }

        // Hydrate the browser session silently. Do NOT refresh the route here:
        // router.refresh() caused the whole Mini App tree to re-render after
        // opening and made Telegram startup feel slow.
        const supabase = createClient()
        const { error } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (error) {
          console.error('[telegram-miniapp-auth] setSession failed', error)
        }
      } catch (error) {
        // Auth is optional at startup. A timeout/network error must never block
        // or redirect the Mini App.
        console.warn('[telegram-miniapp-auth] background authentication skipped', error)
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const start = () => {
      if (cancelled) return true
      const webApp = window.Telegram?.WebApp
      if (!webApp) return false

      // ready()/expand() happen before any network request.
      if (webApp.initData) void authenticate(webApp)
      else {
        webApp.ready()
        webApp.expand()
      }
      return true
    }

    // If another component/page already loaded the SDK, use it immediately.
    if (start()) {
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
      }
    }

    // Telegram's WebView user agents contain "Telegram". Do not inject the
    // SDK on ordinary royalhouse.uz visits; this keeps normal page startup clean.
    const isTelegramWebView = /Telegram/i.test(navigator.userAgent)
    if (!isTelegramWebView) return

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
  }, [])

  return null
}
