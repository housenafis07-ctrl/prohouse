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
 * Authenticate the Telegram Mini App without ever blocking the UI.
 * The server validates Telegram initData and returns a Supabase session;
 * the browser must explicitly hydrate its Supabase client with that session.
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

      // Never wait for auth before releasing the Telegram Mini App UI.
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
        if (cancelled || !response.ok) {
          console.warn('[telegram-miniapp-auth] server auth failed', data?.error || response.status)
          return
        }

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          console.warn('[telegram-miniapp-auth] server returned no session')
          return
        }

        // Critical: the API runs on the server. Its Supabase session does not
        // automatically become the browser's session. Hydrate the exact same
        // browser client used by /account and /listings/new.
        const supabase = createClient()
        const { error } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (error) {
          console.error('[telegram-miniapp-auth] setSession failed', error)
          return
        }

        if (cancelled) return
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
