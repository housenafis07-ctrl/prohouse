'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useTelegramAuthGate } from './TelegramAuthGate'

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

const AUTH_BARRIER_ENABLED = process.env.NEXT_PUBLIC_TG_AUTH_BARRIER === '1'

/**
 * Authenticate the Telegram Mini App. When the I3 barrier is enabled, all
 * session-dependent pages wait for this request before reading Supabase.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const started = useRef(false)
  const { markReady } = useTelegramAuthGate()

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined
    let readyMarked = false

    const finish = () => {
      if (readyMarked) return
      readyMarked = true
      markReady()
    }

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) {
        finish()
        return
      }

      webApp.ready()
      webApp.expand()

      const controller = new AbortController()
      timer = window.setTimeout(() => controller.abort(), 7000)

      try {
        const supabase = createClient()

        // Telegram identity has precedence over any stored browser session.
        // This is intentionally local-only; no server-side identity is used.
        if (AUTH_BARRIER_ENABLED) {
          await supabase.auth.signOut({ scope: 'local' })
        }

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

        if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.profile?.id) {
          console.warn('[telegram-miniapp-auth] server returned incomplete session')
          return
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (setSessionError) {
          console.error('[telegram-miniapp-auth] setSession failed', setSessionError)
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData.user || userData.user.id !== data.profile.id) {
          console.error('[telegram-miniapp-auth] session/profile mismatch')
          await supabase.auth.signOut({ scope: 'local' })
          return
        }

        if (cancelled) return
        router.refresh()
      } catch (error) {
        console.warn('[telegram-miniapp-auth] authentication failed', error)
      } finally {
        if (timer) window.clearTimeout(timer)
        if (AUTH_BARRIER_ENABLED) finish()
      }
    }

    const start = () => {
      if (cancelled) return true
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) {
        finish()
        return false
      }
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
      // If Telegram's script was already loaded before this initializer ran,
      // start immediately instead of waiting forever for a load event that has passed.
      if (window.Telegram?.WebApp) {
        start()
      } else {
        existing.addEventListener('load', start, { once: true })
      }
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
  }, [markReady, router])

  return null
}
